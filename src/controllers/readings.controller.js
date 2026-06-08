const asyncHandler = require('express-async-handler');
const SiteReading = require('../models/siteReading.model');
const SiteAccounting = require('../models/siteAccounting.model');

/**
 * Shared query handler for both time-series collections.
 * Query params: start (required), end (required) — ISO 8601 or YYYY-MM-DD.
 * A bare date (YYYY-MM-DD) is treated as the start of that day in UTC.
 */
async function getReadings(Model, req, res) {
    const { tenant_id, site_id } = req.params;
    const { start, end } = req.query;

    if (!start || !end) {
        return res.status(400).json({ message: 'start and end query parameters are required (ISO 8601 or YYYY-MM-DD).' });
    }

    const tenantIdNum = parseInt(tenant_id);

    if (isNaN(tenantIdNum)) {
        return res.status(400).json({ message: 'tenant_id must be an integer.' });
    }

    const startDate = new Date(start);
    const endDate   = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format for start or end.' });
    }

    if (startDate >= endDate) {
        return res.status(400).json({ message: 'start must be before end.' });
    }

    const readings = await Model.find({
        tenant_id: tenantIdNum,
        site_id,
        timestamp: { $gte: startDate, $lte: endDate }
    })
        .select('-_id -__v -tenant_id -site_id')
        .sort({ timestamp: 1 })
        .lean();

    return res.status(200).json({
        tenant_id: tenantIdNum,
        site_id,
        start:     startDate.toISOString(),
        end:       endDate.toISOString(),
        count:     readings.length,
        readings
    });
}

const getSiteReadings = asyncHandler((req, res) => getReadings(SiteReading, req, res));

const getSiteAccountingData = asyncHandler((req, res) => getReadings(SiteAccounting, req, res));

/**
 * GET /accounting/:tenant_id/latest
 * Returns the most recent accounting log entry for each site in the tenant.
 */
const getLatestSiteData = asyncHandler(async (req, res) => {
    const { tenant_id } = req.params;
    const tenantIdNum = parseInt(tenant_id);

    if (isNaN(tenantIdNum)) {
        return res.status(400).json({ message: 'tenant_id must be an integer.' });
    }

    const results = await SiteAccounting.aggregate([
        { $match: { tenant_id: tenantIdNum } },
        { $sort:  { timestamp: -1 } },
        { $group: {
            _id:            '$site_id',
            timestamp:      { $first: '$timestamp' },
            flr_flow:       { $first: '$flr_flow' },
            ch4:            { $first: '$ch4' },
            inlet_pressure: { $first: '$inlet_pressure' },
            o2:             { $first: '$o2' },
            flr_sdv:        { $first: '$flr_sdv' }
        }},
        { $project: {
            _id:            0,
            site_id:        '$_id',
            timestamp:      1,
            flr_flow:       1,
            ch4:            1,
            inlet_pressure: 1,
            o2:             1,
            flr_sdv:        1
        }},
        { $sort: { site_id: 1 } }
    ]);

    return res.status(200).json({
        tenant_id: tenantIdNum,
        sites: results
    });
});

module.exports = { getSiteReadings, getSiteAccountingData, getLatestSiteData };
