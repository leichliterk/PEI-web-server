const crypto = require('crypto');
const path = require('path');
const SiteFile = require('../../models/siteFile.model');

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
        const { filename, content, encoding, size, timestamp, source, sha256 } = data;
        console.log(`[FileHandler] file_upload received from ${tenant_id}-${site_id}: filename=${filename}, encoding=${encoding}, size=${size}, hasContent=${!!content}, hasHash=${!!sha256}, hasSource=${!!source}`);

        if (!filename || !content || !encoding || !source || !sha256) {
            socket.emit('file_upload_error', { message: 'Missing required fields: filename, content, encoding, source, sha256' });
            return;
        }

        if (encoding !== 'base64') {
            socket.emit('file_upload_error', { message: `Unsupported encoding: ${encoding}` });
            return;
        }

        try {
            const fileBuffer = Buffer.from(content, 'base64');

            // Verify integrity
            const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            if (computedHash !== sha256) {
                console.error(`Hash mismatch for ${filename} from ${tenant_id}-${site_id}`);
                socket.emit('file_upload_error', { message: 'File integrity check failed: SHA-256 mismatch' });
                return;
            }

            const siteFile = await SiteFile.create({
                tenant_id,
                site_id,
                filename,
                content: fileBuffer,
                size: size ?? fileBuffer.length,
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                source,
                sha256,
                category: resolveCategory(filename)
            });

            console.log(`File received from ${tenant_id}-${site_id}: ${filename} (${fileBuffer.length} bytes)`);

            socket.emit('file_upload_ack', {
                success: true,
                file_id: siteFile._id,
                filename
            });
        } catch (error) {
            console.error(`File upload error from ${tenant_id}-${site_id}:`, error);
            socket.emit('file_upload_error', { message: 'Failed to store file' });
        }
    }
};

module.exports = fileHandler;
