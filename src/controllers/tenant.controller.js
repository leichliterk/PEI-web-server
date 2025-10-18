const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Tenant = require("../models/tenant.model");

const getTenantById = asyncHandler(async (req, res, next) => {
    const tenant_id = req.params.tenant_id;

    if (tenant_id) {
        const tenant = await Tenant.findOne({ tenant_id: parseInt(tenant_id) });
        if (!tenant) {
            return res.status(404).json({ message: "Tenant not found" });
        }

        // Calculate uptime and connection status for each site in tenant.sites array
        const stagingConnection = mongoose.createConnection(process.env.MONGODB_URI.replace(/\/\w+$/, '/staging'));
        const connections = stagingConnection.model('site-connection', new mongoose.Schema({
            timestamp: Date,
            site_id: String
        }, { timestamps: false }));

        const sitesWithUptime = await Promise.all(tenant.sites.map(async (site) => {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const connectionCount = await connections.countDocuments({
                site_id: site.id ? site.id.toString() : site.toString(),
                timestamp: { $gte: twentyFourHoursAgo }
            });

            // Check connection status based on last 2 minutes
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const recentConnectionCount = await connections.countDocuments({
                site_id: site.id ? site.id.toString() : site.toString(),
                timestamp: { $gte: twoMinutesAgo }
            });

            const siteObj = typeof site === 'object' ? { ...site } : { id: site };
            siteObj.uptime = connectionCount / 86400;
            siteObj.connection_status = recentConnectionCount >= 2;
            return siteObj;
        }));

        await stagingConnection.close();

        const tenantWithUptime = tenant.toObject();
        tenantWithUptime.sites = sitesWithUptime;

        return res.json(tenantWithUptime);
    } else {
        return res.status(400).json({ message: "Tenant ID missing."});
    }
});

module.exports = {
    getTenantById
};