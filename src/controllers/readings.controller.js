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
    const siteIdNum   = parseInt(site_id);

    if (isNaN(tenantIdNum) || isNaN(siteIdNum)) {
        return res.status(400).json({ message: 'tenant_id and site_id must be integers.' });
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
        site_id:   siteIdNum,
        timestamp: { $gte: startDate, $lte: endDate }
    })
        .select('-_id -__v -tenant_id -site_id')
        .sort({ timestamp: 1 })
        .lean();

    return res.status(200).json({
        tenant_id: tenantIdNum,
        site_id:   siteIdNum,
        start:     startDate.toISOString(),
        end:       endDate.toISOString(),
        count:     readings.length,
        readings
    });
}

const getSiteReadings = asyncHandler((req, res) => getReadings(SiteReading, req, res));

const getSiteAccountingData = asyncHandler((req, res) => getReadings(SiteAccounting, req, res));

module.exports = { getSiteReadings, getSiteAccountingData };
