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

// const getAllSites = asyncHandler(async (req, res, next) => {
//     // Get all sites from site-connections collection in staging database
//     const stagingConnection = mongoose.createConnection(process.env.MONGODB_URI.replace(/\/\w+$/, '/staging'));
//     const sites = stagingConnection.model('sites', Site.schema);
//     const connections = stagingConnection.model('site-connection', new mongoose.Schema({
//         timestamp: Date,
//         site_id: String
//     }, { timestamps: false }));

//     const allSites = await sites.find({});

//     // Calculate uptime and connection status for each site
//     const sitesWithUptime = await Promise.all(allSites.map(async (site) => {
//         const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
//         const connectionCount = await connections.countDocuments({
//             site_id: site.id.toString(),
//             timestamp: { $gte: twentyFourHoursAgo }
//         });

//         // Check connection status based on last 2 minutes
//         const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
//         const recentConnectionCount = await connections.countDocuments({
//             site_id: site.id.toString(),
//             timestamp: { $gte: twoMinutesAgo }
//         });

//         const siteObj = site.toObject();
//         siteObj.uptime = connectionCount / 86400;
//         siteObj.connection_status = recentConnectionCount >= 2;
//         return siteObj;
//     }));

//     await stagingConnection.close();
//     console.log(sitesWithUptime);

//     return res.json(sitesWithUptime);
// });

// const getSite = asyncHandler(async (req, res, next) => {
//     const site_id = req.params.site_id;

//     if (!site_id) {
//         return res.status(400).json({ message: "Site ID missing." });
//     }

//     // Get site from staging database
//     const stagingConnection = mongoose.createConnection(process.env.MONGODB_URI.replace(/\/\w+$/, '/staging'));
//     const sites = stagingConnection.model('sites', Site.schema);
//     const connections = stagingConnection.model('site-connection', new mongoose.Schema({
//         timestamp: Date,
//         site_id: String
//     }, { timestamps: false }));

//     const site = await sites.findById(site_id);

//     if (!site) {
//         await stagingConnection.close();
//         return res.status(404).json({ message: "Site not found" });
//     }

//     // Calculate uptime and connection status for the site
//     const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
//     const connectionCount = await connections.countDocuments({
//         site_id: site.id.toString(),
//         timestamp: { $gte: twentyFourHoursAgo }
//     });

//     // Check connection status based on last 2 minutes
//     const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
//     const recentConnectionCount = await connections.countDocuments({
//         site_id: site.id.toString(),
//         timestamp: { $gte: twoMinutesAgo }
//     });

//     const siteObj = site.toObject();
//     siteObj.uptime = connectionCount / 86400;
//     siteObj.connection_status = recentConnectionCount >= 2;

//     await stagingConnection.close();
//     console.log(siteObj);
//     return res.json(siteObj);
// });

const getConnectionLogs = asyncHandler(async (req, res, next) => {
    const site_id = req.params.site_id;
    const limit = parseInt(req.query.limit) || 10; // Default to 10 if not specified

    if (!site_id) {
        return res.status(400).json({ message: "Site ID missing." });
    }

    try {
        // Retrieve connection logs for the specified site_id, sorted by timestamp descending
        const connectionLogs = await ConnectionLog.find({ site_id: parseInt(site_id) })
            .sort({ timestamp: -1 })
            .limit(limit);

        return res.status(200).json({
            site_id: parseInt(site_id),
            limit,
            count: connectionLogs.length,
            logs: connectionLogs
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