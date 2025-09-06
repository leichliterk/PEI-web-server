const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Site = require("../models/site.model");

const connStatus = asyncHandler(async (req, res, next) => {
    const status = {
        timestamp: new Date(),
        meta: req.body.siteNumber
    };
    
    // Save to site-connections collection in staging database
    const stagingConnection = mongoose.createConnection(process.env.MONGODB_URI.replace(/\/\w+$/, '/staging'));
    const SiteConnection = stagingConnection.model('site-connection', new mongoose.Schema({
        timestamp: Date,
        meta: String
    }, { timestamps: true }));
    
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
        meta: String
    }, { timestamps: true }));
    
    const allSites = await sites.find({});
    
    // Calculate uptime for each site
    const sitesWithUptime = await Promise.all(allSites.map(async (site) => {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const connectionCount = await connections.countDocuments({
            meta: site.id.toString(),
            timestamp: { $gte: twentyFourHoursAgo }
        });
        
        const siteObj = site.toObject();
        siteObj.uptime = connectionCount / 86400;
        return siteObj;
    }));
    
    await stagingConnection.close();
    
    return res.json(sitesWithUptime);
});

module.exports = {
    connStatus,
    getAllSites
};