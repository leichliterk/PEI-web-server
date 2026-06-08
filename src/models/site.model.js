const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    site_id: {
        type: String,
        required: true
    },
    uptime: {
        type: Number,
        required: true
    },
    connection_status: {
        type: Boolean,
        required: true
    },
    meta: {
        type: {},
        required: true
    }
}, { timestamps: true });

const Site = mongoose.model('site-connection', siteSchema);

module.exports = Site;