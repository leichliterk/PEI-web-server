const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Site = require("../models/site.model");

const connStatus = asyncHandler(async (req, res, next) => {
    const status = {
        timestamp: new Date(),
        site_id: req.body.siteNumber
    };
    
    // Save to site-connections collection in staging database
    const stagingConnection = mongoose.createConnection(process.env.MONGODB_URI.replace(/\/\w+$/, '/staging'));
    const SiteConnection = stagingConnection.model('site-connection', new mongoose.Schema({
        timestamp: Date,
        site_id: Number
    }, { timestamps: false }));
    
    const result = await SiteConnection.create(status);
    await stagingConnection.close();
    
    return res.json(result);
});

const getAllSites = asyncHandler(async (req, res, next) => {
    // Get all sites from site-connections collection in staging database
    const stagingConnection = mongoose.createConnection(process.env.MONGODB_URI.replace(/\/\w+$/, '/staging'));
    const sites = stagingConnection.model('sites', Site.schema);
    const connections = stagingConnection.model('site-connection', new mongoose.Schema({
        timestamp: Date,
        site_id: String
    }, { timestamps: false }));

    const allSites = await sites.find({});

    // Calculate uptime and connection status for each site
    const sitesWithUptime = await Promise.all(allSites.map(async (site) => {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const connectionCount = await connections.countDocuments({
            site_id: site.id.toString(),
            timestamp: { $gte: twentyFourHoursAgo }
        });

        // Check connection status based on last 2 minutes
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        const recentConnectionCount = await connections.countDocuments({
            site_id: site.id.toString(),
            timestamp: { $gte: twoMinutesAgo }
        });

        const siteObj = site.toObject();
        siteObj.uptime = connectionCount / 86400;
        siteObj.connection_status = recentConnectionCount >= 2;
        return siteObj;
    }));

    await stagingConnection.close();
    console.log(sitesWithUptime);

    return res.json(sitesWithUptime);
});

const getSite = asyncHandler(async (req, res, next) => {
    const site_id = req.params.site_id;

    if (!site_id) {
        return res.status(400).json({ message: "Site ID missing." });
    }

    // Get site from staging database
    const stagingConnection = mongoose.createConnection(process.env.MONGODB_URI.replace(/\/\w+$/, '/staging'));
    const sites = stagingConnection.model('sites', Site.schema);
    const connections = stagingConnection.model('site-connection', new mongoose.Schema({
        timestamp: Date,
        site_id: String
    }, { timestamps: false }));

    const site = await sites.findById(site_id);

    if (!site) {
        await stagingConnection.close();
        return res.status(404).json({ message: "Site not found" });
    }

    // Calculate uptime and connection status for the site
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const connectionCount = await connections.countDocuments({
        site_id: site.id.toString(),
        timestamp: { $gte: twentyFourHoursAgo }
    });

    // Check connection status based on last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentConnectionCount = await connections.countDocuments({
        site_id: site.id.toString(),
        timestamp: { $gte: twoMinutesAgo }
    });

    const siteObj = site.toObject();
    siteObj.uptime = connectionCount / 86400;
    siteObj.connection_status = recentConnectionCount >= 2;

    await stagingConnection.close();
    console.log(siteObj);
    return res.json(siteObj);
});

module.exports = {
    connStatus,
    getAllSites,
    getSite
};