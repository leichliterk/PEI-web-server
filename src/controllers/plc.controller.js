const asyncHandler = require('express-async-handler');
const plcCache    = require('../websocket/services/plcCache');
const SiteReading = require('../models/siteReading.model');

/**
 * GET /api/data/plc/:tenant_id/:site_id/latest
 * Returns the most recent snapshot. Tries cache first, falls back to DB.
 */
const getLatest = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = req.params.site_id;

    if (isNaN(tenantId)) {
        return res.status(400).json({ error: 'tenant_id must be an integer.' });
    }

    const cached = plcCache.getSnapshot(tenantId, siteId);
    if (cached) return res.json({ tenant_id: tenantId, site_id: siteId, ...cached });

    // Cache miss — query DB; $in handles legacy numeric site_ids in the time-series collection
    const snap = await SiteReading.findOne({ tenant_id: tenantId, site_id: { $in: [siteId, parseInt(siteId)] } })
        .sort({ timestamp: -1 })
        .lean();

    if (!snap) return res.status(404).json({ error: 'No snapshots found for this site.' });

    return res.json(snap);
});

/**
 * GET /api/data/plc/:tenant_id/:site_id/snapshots?minutes=30
 * Returns readings from the past N minutes, sorted ascending.
 * Defaults to 60 minutes if not specified.
 */
const getSnapshots = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = req.params.site_id;
    const minutes  = parseInt(req.query.minutes) || 60;

    if (isNaN(tenantId)) {
        return res.status(400).json({ error: 'tenant_id must be an integer.' });
    }

    const since = new Date(Date.now() - minutes * 60 * 1000);

    const snaps = await SiteReading.find({
        tenant_id: tenantId,
        site_id:   { $in: [siteId, parseInt(siteId)] },
        timestamp: { $gte: since }
    }).sort({ timestamp: 1 }).lean();

    return res.json(snaps);
});

/**
 * GET /api/data/plc/:tenant_id/:site_id/tags
 * Returns the last known tag discovery list from the in-memory cache.
 */
const getTags = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const siteId   = req.params.site_id;

    if (isNaN(tenantId)) {
        return res.status(400).json({ error: 'tenant_id must be an integer.' });
    }

    const cached = plcCache.getTags(tenantId, siteId);
    if (!cached) return res.status(404).json({ error: 'No tag list available for this site.' });

    return res.json({ tenant_id: tenantId, site_id: siteId, ...cached });
});

module.exports = { getLatest, getSnapshots, getTags };
