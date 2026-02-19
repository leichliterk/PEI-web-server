const SiteFile = require('../../models/siteFile.model');

const fileHandler = {
    /**
     * Handle file upload from desktop app
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} data - File payload from desktop
     */
    async onFileUpload(socket, data) {
        const { tenant_id, site_id } = socket.siteData;
        const { filename, content, encoding, size, timestamp, source } = data;

        if (!filename || !content || !encoding || !source) {
            socket.emit('file_upload_error', { message: 'Missing required fields: filename, content, encoding, source' });
            return;
        }

        if (encoding !== 'base64') {
            socket.emit('file_upload_error', { message: `Unsupported encoding: ${encoding}` });
            return;
        }

        try {
            const fileBuffer = Buffer.from(content, 'base64');

            const siteFile = await SiteFile.create({
                tenant_id,
                site_id,
                filename,
                content: fileBuffer,
                size: size ?? fileBuffer.length,
                timestamp: timestamp ? new Date(timestamp) : new Date(),
                source
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
