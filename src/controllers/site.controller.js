const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Site = require("../models/site.model");
const ConnectionLog = require("../models/ConnectionLog");

const connStatus = asyncHandler(async (req, res, next) => {
    const { status, timestamp, details, site_id, queuedFailures = [] } = req.body;

    try {
        // Log the current attempt (usually success, since it reached here)
        await ConnectionLog.create({
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            status: status || 'success',
            site_id,
            details
        });

        // If there are queued failures from the client, log them too
        for (const failure of queuedFailures) {
            await ConnectionLog.create({
                timestamp: new Date(failure.timestamp),
                status: 'failure',
                site_id: failure.site_id || site_id,
                details: failure.details
            });
        }

        return res.status(200).json({ message: 'Logged successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Logging failed', error: error.message });
    }
});

const getConnectionLogs = asyncHandler(async (req, res, next) => {
    const site_id = req.params.site_id;
    const limit = parseInt(req.query.limit) || 10; // Default to 10 if not specified
    const { startDate, endDate } = req.query;

    if (!site_id) {
        return res.status(400).json({ message: "Site ID missing." });
    }

    try {
        // Build the query filter
        const filter = { site_id: parseInt(site_id) };

        // Add date range filter if provided
        if (startDate || endDate) {
            filter.timestamp = {};

            if (startDate) {
                // Set to start of day (00:00:00)
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                filter.timestamp.$gte = start;
            }

            if (endDate) {
                // Set to end of day (23:59:59.999)
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.timestamp.$lte = end;
            }
        }

        // Retrieve connection logs for the specified site_id, sorted by timestamp descending
        const connectionLogs = await ConnectionLog.find(filter)
            .sort({ timestamp: -1 })
            .limit(limit);

        return res.status(200).json({
            site_id: parseInt(site_id),
            limit,
            count: connectionLogs.length,
            logs: connectionLogs,
            ...(startDate && { startDate }),
            ...(endDate && { endDate })
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to retrieve connection logs', error: error.message });
    }
});

module.exports = {
    connStatus,
    // getAllSites,
    // getSite,
    getConnectionLogs
};