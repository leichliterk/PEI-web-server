const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Site = require("../models/site.model");
const Tenant = require("../models/tenant.model");
const ConnectionSession = require("../models/connectionSession.model");


const updateSiteName = asyncHandler(async (req, res, next) => {
    const { tenant_id, site_id } = req.params;
    const { siteName } = req.body;

    if (!tenant_id || !site_id) {
        return res.status(400).json({ message: "Tenant ID and Site ID are required." });
    }

    if (!siteName || typeof siteName !== 'string' || siteName.trim() === '') {
        return res.status(400).json({ message: "Valid site name is required." });
    }

    try {
        const tenantIdNum = parseInt(tenant_id);

        // Find the tenant
        const tenant = await Tenant.findOne({ tenant_id: tenantIdNum });

        if (!tenant) {
            return res.status(404).json({ message: "Tenant not found." });
        }

        // Find the site in the tenant's sites array
        const siteIndex = tenant.sites.findIndex(site => site.site_id === site_id);

        if (siteIndex === -1) {
            return res.status(404).json({ message: "Site not found in tenant." });
        }

        // Update the site name
        tenant.sites[siteIndex].name = siteName.trim();

        // Mark the sites array as modified to ensure Mongoose saves it
        tenant.markModified('sites');

        // Save the updated tenant
        const savedTenant = await tenant.save();

        return res.status(200).json({
            message: "Site name updated successfully.",
            tenant_id: tenantIdNum,
            site_id,
            name: siteName.trim(),
            updatedSite: savedTenant.sites[siteIndex]
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update site name', error: error.message });
    }
});

const getConnectionUptime = asyncHandler(async (req, res) => {
    const { tenant_id, site_id } = req.params;
    const { days = 7 } = req.query;

    if (!tenant_id || !site_id) {
        return res.status(400).json({ message: "Tenant ID and Site ID are required." });
    }

    const tenantIdNum = parseInt(tenant_id);
    const daysNum = parseInt(days);

    if (isNaN(daysNum) || daysNum < 1) {
        return res.status(400).json({ message: "Days must be a positive integer." });
    }

    try {
        const now = new Date();
        const startDate = new Date(now.getTime() - daysNum * 24 * 60 * 60 * 1000);

        // Get all sessions within the time range
        const sessions = await ConnectionSession.find({
            tenant_id: tenantIdNum,
            site_id,
            connected_at: { $gte: startDate }
        }).sort({ connected_at: 1 });

        // Calculate total uptime
        const totalTimeMs = now.getTime() - startDate.getTime();
        let totalUptimeMs = 0;

        sessions.forEach(session => {
            // Clamp session start to the query window
            const sessionStart = session.connected_at < startDate ? startDate : session.connected_at;
            // null disconnected_at means the session is still open; treat as now
            const sessionEnd = (!session.disconnected_at || session.disconnected_at > now) ? now : session.disconnected_at;
            totalUptimeMs += sessionEnd.getTime() - sessionStart.getTime();
        });

        const uptimePercentage = (totalUptimeMs / totalTimeMs) * 100;

        // Build sessions array; open sessions (disconnected_at: null) are included naturally
        const sessionList = sessions.map(s => ({
            connected_at: s.connected_at,
            disconnected_at: s.disconnected_at,
            duration_ms: s.duration_ms,
            disconnect_reason: s.disconnect_reason,
            connection_source: s.connection_source
        }));

        return res.status(200).json({
            tenant_id: tenantIdNum,
            site_id,
            days: daysNum,
            start_date: startDate.toISOString(),
            end_date: now.toISOString(),
            total_time_ms: totalTimeMs,
            total_uptime_ms: totalUptimeMs,
            uptime_percentage: Math.round(uptimePercentage * 100) / 100,
            sessions: sessionList
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to retrieve connection uptime', error: error.message });
    }
});

module.exports = {
    updateSiteName,
    getConnectionUptime
};