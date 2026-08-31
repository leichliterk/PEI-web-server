const Tenant = require('../models/tenant.model');
const SiteAccounting = require('../models/siteAccounting.model');
const SiteReading = require('../models/siteReading.model');
const DailyReport = require('../models/dailyReport.model');

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
 * Compute uptime (seconds) for a single site on a single day.
 */
async function computeUptime(tenantId, siteId, dayStart, dayEnd) {
    const result = await SiteReading.aggregate([
        { $match: {
            tenant_id: tenantId,
            site_id: { $in: [siteId, parseInt(siteId)] },
            timestamp: { $gte: dayStart, $lte: dayEnd }
        }},
        { $addFields: {
            flare_tag: { $arrayElemAt: [
                { $filter: { input: '$tags', as: 't', cond: { $eq: ['$$t.displayName', 'Flare flow'] } } },
                0
            ]}
        }},
        { $match: { 'flare_tag.error': { $ne: true }, 'flare_tag.value': { $gt: 0 } } },
        { $project: { timestamp: 1, snapshot_interval: 1 } },
        { $sort: { timestamp: 1 } },
        { $setWindowFields: {
            sortBy: { timestamp: 1 },
            output: {
                prev_ts:       { $shift: { output: '$timestamp',         by: -1, default: null } },
                prev_interval: { $shift: { output: '$snapshot_interval', by: -1, default: null } }
            }
        }},
        { $match: { prev_ts: { $ne: null } } },
        { $group: {
            _id: null,
            uptime_seconds: { $sum: {
                $let: {
                    vars: {
                        deltaMs:  { $subtract: ['$timestamp', '$prev_ts'] },
                        maxGapMs: { $multiply: [{ $ifNull: ['$prev_interval', 5000] }, 2] }
                    },
                    in: { $cond: [
                        { $and: [{ $gt: ['$$deltaMs', 0] }, { $lte: ['$$deltaMs', '$$maxGapMs'] }] },
                        { $round: [{ $divide: ['$$deltaMs', 1000] }, 0] },
                        0
                    ]}
                }
            }}
        }}
    ]);

    return result.length > 0 ? result[0].uptime_seconds : 0;
}

/**
 * Build daily report data for a specific date across all tenants and sites.
 * @param {string} dateKey - YYYY-MM-DD
 */
async function buildForDate(dateKey) {
    const dayStart = new Date(dateKey + 'T00:00:00.000Z');
    const dayEnd   = new Date(dateKey + 'T23:59:59.999Z');

    const tenants = await Tenant.find().lean();

    for (const tenant of tenants) {
        const tenantId = tenant.tenant_id;
        const sites = tenant.sites || [];

        // Fetch all accounting records for this tenant on this day
        const records = await SiteAccounting.find({
            tenant_id: tenantId,
            date_key: dateKey
        }).select('site_id flr_flow ch4').lean();

        // Sum credits per site
        const creditsBySite = {};
        for (const r of records) {
            const val = calcNetMtCh4(r.flr_flow, r.ch4);
            if (val === null) continue;
            const sid = String(r.site_id);
            creditsBySite[sid] = (creditsBySite[sid] ?? 0) + val;
        }

        // Compute uptime and upsert for each site
        for (const site of sites) {
            const siteId = String(site.site_id);
            const uptime = await computeUptime(tenantId, siteId, dayStart, dayEnd);
            const credits = creditsBySite[siteId] ?? null;

            await DailyReport.findOneAndUpdate(
                { tenant_id: tenantId, site_id: siteId, date_key: dateKey },
                { credits, uptime },
                { upsert: true }
            );
        }

        console.log(`[DailyReportBuilder] Built ${dateKey} for tenant ${tenantId} (${sites.length} sites)`);
    }
}

/**
 * Nightly job: build report for yesterday.
 */
async function buildYesterday() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dateKey = yesterday.toISOString().slice(0, 10);
    console.log(`[DailyReportBuilder] Starting nightly build for ${dateKey}`);
    try {
        await buildForDate(dateKey);
        console.log(`[DailyReportBuilder] Nightly build complete for ${dateKey}`);
    } catch (err) {
        console.error(`[DailyReportBuilder] Nightly build failed for ${dateKey}:`, err);
    }
}

module.exports = { buildForDate, buildYesterday };
