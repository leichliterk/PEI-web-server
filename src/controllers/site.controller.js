const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Site = require("../models/site.model");
const Tenant = require("../models/tenant.model");


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
        const siteIdNum = parseInt(site_id);

        // Find the tenant
        const tenant = await Tenant.findOne({ tenant_id: tenantIdNum });

        if (!tenant) {
            return res.status(404).json({ message: "Tenant not found." });
        }

        // Find the site in the tenant's sites array
        const siteIndex = tenant.sites.findIndex(site => site.site_id === siteIdNum);

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
            site_id: siteIdNum,
            name: siteName.trim(),
            updatedSite: savedTenant.sites[siteIndex]
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update site name', error: error.message });
    }
});

module.exports = {
    updateSiteName
};