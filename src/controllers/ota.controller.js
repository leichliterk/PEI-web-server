const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const OtaRelease = require('../models/otaRelease.model');
const OtaReleaseResponse = require('../models/otaReleaseResponse.model');
const Tenant = require('../models/tenant.model');
const notificationService = require('../websocket/services/notificationService');
const connectionManager = require('../websocket/services/connectionManager');
const { getDesktopNamespace } = require('../websocket/namespaceRegistry');

// Requires OTA_JWT_SECRET in environment variables
const OTA_JWT_SECRET = process.env.OTA_JWT_SECRET;
const TOKEN_EXPIRY = '48h';

function getBucket() {
    return new GridFSBucket(mongoose.connection.db, { bucketName: 'ota_releases' });
}

function generateDownloadToken(releaseId, tenant_id, site_id) {
    return jwt.sign(
        { release_id: releaseId.toString(), tenant_id, site_id, type: 'ota_download' },
        OTA_JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
}

const otaController = {

    /**
     * POST /api/data/ota/upload
     * Upload a new .exe and notify all sites for the tenant.
     * Multipart form fields: tenant_id, version, notes, created_by
     * File field name: 'exe'
     */
    async uploadRelease(req, res) {
        if (!OTA_JWT_SECRET) {
            return res.status(500).json({ error: 'OTA_JWT_SECRET is not configured on the server' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { tenant_id, version, notes, created_by } = req.body;

        if (!tenant_id || !version) {
            return res.status(400).json({ error: 'tenant_id and version are required' });
        }

        const tenantId = parseInt(tenant_id);

        const tenant = await Tenant.findOne({ tenant_id: tenantId });
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // Compute SHA-256 of the uploaded binary
        const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

        // Stream the buffer into GridFS
        const bucket = getBucket();
        const uploadStream = bucket.openUploadStream(req.file.originalname, {
            metadata: { tenant_id: tenantId, version, sha256 }
        });

        await new Promise((resolve, reject) => {
            uploadStream.on('finish', resolve);
            uploadStream.on('error', reject);
            uploadStream.end(req.file.buffer);
        });

        const gridfsFileId = uploadStream.id;

        // Supersede any previously active releases for this tenant
        await OtaRelease.updateMany(
            { tenant_id: tenantId, status: 'active' },
            { status: 'superseded' }
        );

        const release = await OtaRelease.create({
            tenant_id: tenantId,
            version,
            filename:       req.file.originalname,
            size:           req.file.size,
            sha256,
            notes:          notes || '',
            gridfs_file_id: gridfsFileId,
            created_by:     created_by || null,
            status:         'active'
        });

        // Notify every site in the tenant; each token is scoped to that site
        const sites = tenant.sites;
        await Promise.all(
            sites.map(site => {
                const token = generateDownloadToken(release._id, tenantId, site.site_id);
                return notificationService.sendToSite(tenantId, site.site_id, {
                    title: 'Software Update Available',
                    body: `Version ${version} is ready. Would you like to update now?`,
                    type: 'info',
                    data: {
                        ota: true,
                        release_id:     release._id.toString(),
                        version,
                        notes:          notes || '',
                        size:           req.file.size,
                        sha256,
                        download_token: token
                    }
                });
            })
        );

        console.log(`OTA release ${version} uploaded for tenant ${tenantId}; notified ${sites.length} site(s)`);

        res.status(201).json({
            release_id:     release._id,
            version:        release.version,
            filename:       release.filename,
            size:           release.size,
            sha256:         release.sha256,
            tenant_id:      tenantId,
            sites_notified: sites.length,
            created_at:     release.createdAt
        });
    },

    /**
     * GET /api/data/ota/releases/:tenant_id
     * List all releases for a tenant with response summaries.
     */
    async listReleases(req, res) {
        const tenantId = parseInt(req.params.tenant_id);

        const releases = await OtaRelease.find({ tenant_id: tenantId })
            .sort({ createdAt: -1 })
            .select('-gridfs_file_id')
            .lean();

        const releaseIds = releases.map(r => r._id);
        const responses  = await OtaReleaseResponse.find({ release_id: { $in: releaseIds } }).lean();

        // Build a per-release summary
        const summaryMap = {};
        for (const r of responses) {
            const key = r.release_id.toString();
            if (!summaryMap[key]) summaryMap[key] = { accepted: 0, declined: 0, installed: 0 };
            if (r.accepted) summaryMap[key].accepted++;
            else summaryMap[key].declined++;
            if (r.installed_at) summaryMap[key].installed++;
        }

        res.json(
            releases.map(r => ({
                ...r,
                responses: summaryMap[r._id.toString()] || { accepted: 0, declined: 0, installed: 0 }
            }))
        );
    },

    /**
     * GET /api/data/ota/download/:release_id
     * Stream the .exe to the desktop app.
     * Requires: Authorization: Bearer <download_token>
     */
    async downloadRelease(req, res) {
        if (!OTA_JWT_SECRET) {
            return res.status(500).json({ error: 'OTA_JWT_SECRET is not configured on the server' });
        }

        // Accept token from Authorization header OR ?token= query param
        const bearerToken = req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.slice(7)
            : null;
        const rawToken = bearerToken || req.query.token || null;

        if (!rawToken) {
            return res.status(401).json({ error: 'Missing download token' });
        }

        let payload;
        try {
            payload = jwt.verify(rawToken, OTA_JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Invalid or expired download token' });
        }

        if (payload.type !== 'ota_download' || payload.release_id !== req.params.release_id) {
            return res.status(403).json({ error: 'Token is not valid for this release' });
        }

        const release = await OtaRelease.findById(req.params.release_id);
        if (!release) {
            return res.status(404).json({ error: 'Release not found' });
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${release.filename}"`);
        res.setHeader('Content-Length', release.size);
        res.setHeader('X-Release-Version', release.version);
        res.setHeader('X-SHA256', release.sha256);

        const bucket = getBucket();
        const downloadStream = bucket.openDownloadStream(release.gridfs_file_id);

        downloadStream.on('error', err => {
            console.error(`OTA download stream error for release ${release._id}:`, err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            }
        });

        downloadStream.pipe(res);
    },

    /**
     * GET /api/data/ota/responses/:release_id
     * Per-site response details for a release (admin).
     */
    async getReleaseResponses(req, res) {
        const responses = await OtaReleaseResponse.find({ release_id: req.params.release_id })
            .sort({ responded_at: -1 })
            .lean();

        res.json(responses);
    },

    /**
     * PATCH /api/data/ota/releases/:id
     * Update a release's notes or status (e.g. manually archive).
     * Body: { notes?, status? }
     */
    async patchRelease(req, res) {
        const { notes, status } = req.body;
        const allowed = ['active', 'superseded', 'archived'];

        if (status && !allowed.includes(status)) {
            return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
        }

        const update = {};
        if (notes  !== undefined) update.notes  = notes;
        if (status !== undefined) update.status = status;

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ error: 'Nothing to update — provide notes or status' });
        }

        const release = await OtaRelease.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true }
        ).select('-gridfs_file_id');

        if (!release) {
            return res.status(404).json({ error: 'Release not found' });
        }

        res.json(release);
    },

    /**
     * POST /api/data/ota/releases/:id/install
     * Dispatch an unattended install command to a specific site.
     * Body: { tenant_id, site_id }
     * The site must be currently connected.
     */
    async sendInstallCommand(req, res) {
        if (!OTA_JWT_SECRET) {
            return res.status(500).json({ error: 'OTA_JWT_SECRET is not configured on the server' });
        }

        const tenantId = parseInt(req.body.tenant_id);
        const siteId   = parseInt(req.body.site_id);

        if (isNaN(tenantId) || isNaN(siteId)) {
            return res.status(400).json({ error: 'tenant_id and site_id are required integers' });
        }

        const release = await OtaRelease.findById(req.params.id);
        if (!release) {
            return res.status(404).json({ error: 'Release not found' });
        }
        if (release.tenant_id !== tenantId) {
            return res.status(403).json({ error: 'Release does not belong to this tenant' });
        }

        const conn = connectionManager.getConnection(tenantId, siteId);
        if (!conn) {
            return res.status(409).json({ error: 'Site is not currently connected' });
        }

        const ns = getDesktopNamespace();
        const socket = ns ? ns.sockets.get(conn.socketId) : null;
        if (!socket) {
            return res.status(409).json({ error: 'Site socket not found' });
        }

        // Build a self-contained download URL valid for 2 hours
        const token = generateDownloadToken(release._id, tenantId, siteId);
        const baseUrl = process.env.SERVER_BASE_URL ||
            `${req.protocol}://${req.get('host')}`;
        const download_url = `${baseUrl}/api/data/ota/download/${release._id}?token=${token}`;

        socket.emit('ota:install_command', {
            release_id:   release._id.toString(),
            version:      release.version,
            sha256:       release.sha256,
            download_url
        });

        console.log(`OTA install command dispatched to ${tenantId}-${siteId}: v${release.version}`);

        return res.json({ dispatched: true, release_id: release._id, version: release.version });
    },

    /**
     * DELETE /api/data/ota/releases/:id
     * Delete a release and its GridFS binary. Also removes all response records.
     */
    async deleteRelease(req, res) {
        const release = await OtaRelease.findById(req.params.id);
        if (!release) {
            return res.status(404).json({ error: 'Release not found' });
        }

        // Delete the GridFS file
        try {
            const bucket = getBucket();
            await bucket.delete(release.gridfs_file_id);
        } catch (err) {
            // File may already be missing — log but continue
            console.warn(`GridFS delete warning for release ${release._id}:`, err.message);
        }

        await OtaReleaseResponse.deleteMany({ release_id: release._id });
        await release.deleteOne();

        console.log(`OTA release ${release.version} (${release._id}) deleted`);

        res.json({ deleted: true, release_id: release._id, version: release.version });
    }
};

module.exports = {
    uploadRelease:       otaController.uploadRelease,
    listReleases:        otaController.listReleases,
    downloadRelease:     otaController.downloadRelease,
    getReleaseResponses: otaController.getReleaseResponses,
    patchRelease:        otaController.patchRelease,
    deleteRelease:       otaController.deleteRelease,
    sendInstallCommand:  otaController.sendInstallCommand
};
