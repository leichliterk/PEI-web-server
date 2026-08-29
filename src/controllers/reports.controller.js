const asyncHandler = require('express-async-handler');
const SiteAccounting = require('../models/siteAccounting.model');
const SiteReading = require('../models/siteReading.model');
const Tenant = require('../models/tenant.model');

const CONSTANTS = { T: 15, DE: 99.5, CF: 25, PEMDF: 2.744 };

function calcNetMtCh4(flr_flow, ch4) {
    if (flr_flow == null || ch4 == null) return null;
    const MMCF     = (flr_flow * CONSTANTS.T * (ch4 / 100)) / 1_000_000;
    const MT_CH4   = (MMCF * 0.0423 * 0.000454) * 1_000_000;
    const MD       = MT_CH4 * (CONSTANTS.DE / 100);
    const MTM_CO2e = (MMCF * 0.0423 * 0.000454 * CONSTANTS.CF) * 1_000_000;
    const PEmd     = MD * CONSTANTS.PEMDF;
    const PEum     = MT_CH4 * (1 - (CONSTANTS.DE / 100)) * CONSTANTS.CF;
    return MTM_CO2e - PEmd - PEum;
}

/**
 * GET /api/data/reports/daily-destruction/:tenant_id?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns daily Net_MT_CH4 destruction credits per site for the given date range.
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

    const startDate = new Date(start + 'T00:00:00.000Z');
    const endDate   = new Date(end   + 'T23:59:59.999Z');

    const [tenant, records, snapshots] = await Promise.all([
        Tenant.findOne({ tenant_id: tenantId }).lean(),
        SiteAccounting.find({
            tenant_id: tenantId,
            date_key:  { $gte: start, $lte: end }
        }).select('site_id date_key flr_flow ch4').lean(),
        SiteReading.aggregate([
            { $match: { tenant_id: tenantId, timestamp: { $gte: startDate, $lte: endDate } } },
            // Extract flare flow value from the tags array
            { $addFields: {
                flare_tag: { $arrayElemAt: [
                    { $filter: { input: '$tags', as: 't', cond: { $eq: ['$$t.displayName', 'Flare flow'] } } },
                    0
                ]}
            }},
            // Only keep snapshots with a valid positive flare flow
            { $match: { 'flare_tag.error': { $ne: true }, 'flare_tag.value': { $gt: 0 } } },
            // Strip heavy fields before sorting to reduce memory
            { $project: { site_id: 1, timestamp: 1, snapshot_interval: 1 } },
            // Sort by site then time so $setWindowFields can compute row-by-row deltas
            { $sort: { site_id: 1, timestamp: 1 } },
            // Compute previous timestamp and interval per site using a sliding window
            { $setWindowFields: {
                partitionBy: '$site_id',
                sortBy: { timestamp: 1 },
                output: {
                    prev_ts:       { $shift: { output: '$timestamp',         by: -1, default: null } },
                    prev_interval: { $shift: { output: '$snapshot_interval', by: -1, default: null } }
                }
            }},
            // Calculate delta and determine if it counts as uptime
            { $addFields: {
                date_key: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                delta_sec: { $cond: [
                    { $eq: ['$prev_ts', null] },
                    0,
                    { $let: {
                        vars: {
                            deltaMs:  { $subtract: ['$timestamp', '$prev_ts'] },
                            maxGapMs: { $multiply: [{ $ifNull: ['$prev_interval', 60000] }, 2] }
                        },
                        in: { $cond: [
                            { $and: [{ $gt: ['$$deltaMs', 0] }, { $lte: ['$$deltaMs', '$$maxGapMs'] }] },
                            { $round: [{ $divide: ['$$deltaMs', 1000] }, 0] },
                            0
                        ]}
                    }}
                ]}
            }},
            // Sum per site per day
            { $group: {
                _id: { site_id: { $toString: '$site_id' }, date_key: '$date_key' },
                uptime_seconds: { $sum: '$delta_sec' }
            }},
            { $project: { _id: 0, site_id: '$_id.site_id', date_key: '$_id.date_key', uptime_seconds: 1 } }
        ])
    ]);

    if (!tenant) {
        return res.status(404).json({ message: 'Tenant not found.' });
    }

    const sites = (tenant.sites || []).map(s => ({ site_id: s.site_id, name: s.name }));

    // Accumulate Net_MT_CH4 per date_key → site_id
    const sums = {};   // { date_key: { site_id: number } }
    for (const r of records) {
        const val = calcNetMtCh4(r.flr_flow, r.ch4);
        if (val === null) continue;
        if (!sums[r.date_key]) sums[r.date_key] = {};
        sums[r.date_key][r.site_id] = (sums[r.date_key][r.site_id] ?? 0) + val;
    }

    // Build sorted date list spanning start→end
    const dates = [];
    const cur = new Date(start + 'T00:00:00Z');
    const last = new Date(end   + 'T00:00:00Z');
    while (cur <= last) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // Build uptime lookup from aggregation results
    const uptime = {};  // { date_key: { site_id: seconds } }
    for (const row of snapshots) {
        if (!uptime[row.date_key]) uptime[row.date_key] = {};
        uptime[row.date_key][row.site_id] = row.uptime_seconds;
    }

    // Build data matrix — null where no records existed
    const data = {};
    for (const date of dates) {
        data[date] = {};
        for (const site of sites) {
            const key = String(site.site_id);
            data[date][key] = {
                credits: sums[date]?.[site.site_id] ?? null,
                uptime:  uptime[date]?.[key] ?? 0
            };
        }
    }

    return res.json({ sites, dates, data, constants: CONSTANTS });
});

module.exports = { getDailyDestructionCredits };
