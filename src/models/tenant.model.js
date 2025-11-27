const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
    tenant_id: {
        type: Number,
        required: true
    },
    sites: {
        type: Array,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    meta: {
        type: {},
        required: true
    }
}, { timestamps: true });

const Tenant = mongoose.model('tenant', tenantSchema);

module.exports = Tenant;