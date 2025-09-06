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
    
    const allSites = await sites.find({});
    await stagingConnection.close();
    
    return res.json(allSites);
});

module.exports = {
    connStatus,
    getAllSites
};