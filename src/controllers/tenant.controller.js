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
        return res.json(tenant);
    } else {
        return res.status(400).json({ message: "Tenant ID missing."});
    }
});

module.exports = {
    getTenantById
};