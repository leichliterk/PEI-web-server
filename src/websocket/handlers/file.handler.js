const crypto = require('crypto');
const path = require('path');
const SiteFile = require('../../models/siteFile.model');
const Tenant = require('../../models/tenant.model');

function resolveCategory(filename) {
    if (filename.includes('AccountingLog')) return 'accounting_log';
    if (filename.includes('LineTrendGraph')) return 'flare_data';
    if (path.extname(filename).toUpperCase() === '.DAE') return 'cr_files';
    return 'uncategorized';
}

const fileHandler = {
    /**
     * Handle file upload from desktop app
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} data - File payload from desktop
     */
    async onFileUpload(socket, data) {
        const { tenant_id, site_id } = socket.siteData;
        const { filename, content, encoding, size, modifiedAt, sha256 } = data;
        const source = data.source || 'unknown';
        console.log(`[FileHandler] ftp:file received from ${tenant_id}-${site_id}: filename=${filename}, encoding=${encoding}, size=${size}, hasContent=${!!content}, hasHash=${!!sha256}, hasSource=${!!data.source}`);

        if (!filename || !content || !encoding || !sha256) {
            socket.emit('ftp:file_ack', { success: false, filename, error: 'Missing required fields: filename, content, encoding, sha256' });
            return;
        }

        if (encoding !== 'base64') {
            socket.emit('ftp:file_ack', { success: false, filename, error: `Unsupported encoding: ${encoding}` });
            return;
        }

        try {
            const fileBuffer = Buffer.from(content, 'base64');

            // Verify integrity
            const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            if (computedHash !== sha256) {
                console.error(`Hash mismatch for ${filename} from ${tenant_id}-${site_id}`);
                socket.emit('ftp:file_ack', { success: false, filename, error: 'File integrity check failed: SHA-256 mismatch' });
                return;
            }

            const siteFile = await SiteFile.findOneAndUpdate(
                { tenant_id, site_id, filename },
                {
                    content: fileBuffer,
                    size: size ?? fileBuffer.length,
                    modifiedAt: modifiedAt ? new Date(modifiedAt) : new Date(),
                    source,
                    sha256,
                    category: resolveCategory(filename)
                },
                { upsert: true, new: true }
            );

            console.log(`File received from ${tenant_id}-${site_id}: ${filename} (${fileBuffer.length} bytes)`);

            // Refresh last_seen in MongoDB so HTTP consumers don't see a stale value
            // (file uploads are the only activity signal after connect, now that heartbeats are gone)
            await Tenant.findOneAndUpdate(
                { tenant_id, 'sites.site_id': site_id },
                { $set: { 'sites.$.last_seen': new Date() } }
            );

            socket.emit('ftp:file_ack', { success: true, filename, file_id: siteFile._id });
        } catch (error) {
            console.error(`File upload error from ${tenant_id}-${site_id}:`, error);
            socket.emit('ftp:file_ack', { success: false, filename, error: 'Failed to store file' });
        }
    }
};

module.exports = fileHandler;
