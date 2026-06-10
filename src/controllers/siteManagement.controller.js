const asyncHandler = require('express-async-handler');
const Tenant = require('../models/tenant.model');
const connectionManager = require('../websocket/services/connectionManager');
const siteStatusCache = require('../websocket/services/siteStatusCache');
const { getDesktopNamespace } = require('../websocket/namespaceRegistry');

const COMMAND_TIMEOUT_MS = 10_000;

/**
 * Resolve the live Socket.io socket for a connected site.
 * Returns null if the site is not connected or the socket can't be found.
 */
function getSiteSocket(tenant_id, site_id) {
    const conn = connectionManager.getConnection(tenant_id, site_id);
    if (!conn) return null;
    const ns = getDesktopNamespace();
    return ns ? (ns.sockets.get(conn.socketId) ?? null) : null;
}

/**
 * Emit a command to a site socket and wait for its ack event.
 * Resolves { success, error } within COMMAND_TIMEOUT_MS.
 */
function sendCommand(socket, emitEvent, ackEvent, payload) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            socket.off(ackEvent, handler);
            resolve({ success: false, error: 'Command timed out' });
        }, COMMAND_TIMEOUT_MS);

        function handler(data) {
            clearTimeout(timer);
            resolve({ success: data?.success ?? false, error: data?.error ?? null });
        }

        socket.once(ackEvent, handler);
        socket.emit(emitEvent, payload);
    });
}

/**
 * GET /api/data/site-management/:tenant_id/:site_id/status
 */
const getStatus = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = req.params.site_id;

    if (isNaN(tenantId)) {
        return res.status(400).json({ error: 'tenant_id must be an integer.' });
    }

    const tenant = await Tenant.findOne({ tenant_id: tenantId }).lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

    const site = (tenant.sites || []).find(s => s.site_id === siteId);
    if (!site) return res.status(404).json({ error: 'Site not found.' });

    const cached = siteStatusCache.getStatus(tenantId, siteId);
    const connected = connectionManager.isConnected(tenantId, siteId);

    return res.json({
        site_id:   siteId,
        name:      site.name,
        connected,
        service: cached.service ?? { state: 'unknown', updatedAt: null },
        ftp:     cached.ftp     ?? { paused: false, queueDepth: 0, updatedAt: null }
    });
});

/**
 * POST /api/data/site-management/:tenant_id/:site_id/service/:action
 * action: stop | start | restart
 */
const serviceCommand = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = req.params.site_id;
    const { action } = req.params;

    if (!['stop', 'start', 'restart'].includes(action)) {
        return res.status(400).json({ error: `Invalid action '${action}'. Valid: stop, start, restart` });
    }

    const socket = getSiteSocket(tenantId, siteId);
    if (!socket) {
        return res.status(200).json({ success: false, error: 'Site not connected' });
    }

    const result = await sendCommand(socket, 'service:command', 'service:command_ack', { action });
    return res.json(result);
});

/**
 * POST /api/data/site-management/:tenant_id/:site_id/ftp/:action
 * action: pause | resume | full-upload
 */
const ftpCommand = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = req.params.site_id;
    const { action } = req.params;

    if (!['pause', 'resume', 'full-upload'].includes(action)) {
        return res.status(400).json({ error: `Invalid action '${action}'. Valid: pause, resume, full-upload` });
    }

    const socket = getSiteSocket(tenantId, siteId);
    if (!socket) {
        return res.status(200).json({ success: false, error: 'Site not connected' });
    }

    const result = await sendCommand(socket, 'ftp:command', 'ftp:command_ack', { action });
    return res.json(result);
});

module.exports = { getStatus, serviceCommand, ftpCommand };
