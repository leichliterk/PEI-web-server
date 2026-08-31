const asyncHandler = require('express-async-handler');
const Tenant = require('../models/tenant.model');
const DailyReport = require('../models/dailyReport.model');

const CONSTANTS = { T: 15, DE: 99.5, CF: 25, PEMDF: 2.744 };

/**
 * GET /api/data/reports/daily-destruction/:tenant_id?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns daily destruction credits and uptime per site from pre-computed data.
 */
const getDailyDestructionCredits = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const { start, end } = req.query;

    if (isNaN(tenantId)) {
        return res.status(400).json({ message: 'tenant_id must be an integer.' });
    }
    if (!start || !end) {
        return res.status(400).json({ message: 'start and end query parameters are required (YYYY-MM-DD).' });
    }

    const [tenant, reports] = await Promise.all([
        Tenant.findOne({ tenant_id: tenantId }).lean(),
        DailyReport.find({
            tenant_id: tenantId,
            date_key: { $gte: start, $lte: end }
        }).lean()
    ]);

    if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found.' });
    }

    const sites = (tenant.sites || []).map(s => ({ site_id: s.site_id, name: s.name }));

    // Build lookup from pre-computed reports
    const lookup = {};  // { date_key: { site_id: { credits, uptime } } }
    for (const r of reports) {
        if (!lookup[r.date_key]) lookup[r.date_key] = {};
        lookup[r.date_key][r.site_id] = { credits: r.credits, uptime: r.uptime };
    }

    // Build sorted date list spanning start→end
    const dates = [];
    const cur = new Date(start + 'T00:00:00Z');
    const last = new Date(end   + 'T00:00:00Z');
    while (cur <= last) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Build data matrix
    const data = {};
    for (const date of dates) {
        data[date] = {};
        for (const site of sites) {
            const key = String(site.site_id);
            data[date][key] = lookup[date]?.[key] ?? { credits: null, uptime: 0 };
        }
    }

    return res.json({ sites, dates, data, constants: CONSTANTS });
});

module.exports = { getDailyDestructionCredits };
