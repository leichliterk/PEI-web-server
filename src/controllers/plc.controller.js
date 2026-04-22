const asyncHandler = require('express-async-handler');
const PlcSnapshot = require('../models/plcSnapshot.model');
const plcCache    = require('../websocket/services/plcCache');

/**
 * GET /api/data/plc/:tenant_id/:site_id/latest
 * Returns the most recent snapshot. Tries cache first, falls back to DB.
 */
const getLatest = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = parseInt(req.params.site_id);

    if (isNaN(tenantId) || isNaN(siteId)) {
        return res.status(400).json({ error: 'tenant_id and site_id must be integers.' });
    }

    const cached = plcCache.getSnapshot(tenantId, siteId);
    if (cached) return res.json({ tenant_id: tenantId, site_id: siteId, ...cached });

    // Cache miss — query DB
    const snap = await PlcSnapshot.findOne({ tenant_id: tenantId, site_id: siteId })
        .sort({ timestamp: -1 })
        .lean();

    if (!snap) return res.status(404).json({ error: 'No snapshots found for this site.' });

    return res.json(snap);
});

/**
 * GET /api/data/plc/:tenant_id/:site_id/snapshots?start=ISO&end=ISO
 * Returns snapshots within a timestamp range, sorted ascending.
 */
const getSnapshots = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = parseInt(req.params.site_id);
    const { start, end } = req.query;

    if (isNaN(tenantId) || isNaN(siteId)) {
        return res.status(400).json({ error: 'tenant_id and site_id must be integers.' });
    }
    if (!start || !end) {
        return res.status(400).json({ error: 'start and end query parameters are required (ISO 8601).' });
    }

    const startDate = new Date(start);
    const endDate   = new Date(end);

    if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ error: 'Invalid date format for start or end.' });
    }

    const snaps = await PlcSnapshot.find({
        tenant_id: tenantId,
        site_id:   siteId,
        timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: 1 }).lean();

    return res.json(snaps);
});

/**
 * GET /api/data/plc/:tenant_id/:site_id/tags
 * Returns the last known tag discovery list from the in-memory cache.
 */
const getTags = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = parseInt(req.params.site_id);

    if (isNaN(tenantId) || isNaN(siteId)) {
        return res.status(400).json({ error: 'tenant_id and site_id must be integers.' });
    }

    const cached = plcCache.getTags(tenantId, siteId);
    if (!cached) return res.status(404).json({ error: 'No tag list available for this site.' });

    return res.json({ tenant_id: tenantId, site_id: siteId, ...cached });
});

module.exports = { getLatest, getSnapshots, getTags };
