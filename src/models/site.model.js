const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    id: {
        type: Number,
        required: true
    },
    meta: {
        type: {},
        required: true
    }
}, { timestamps: true });

const Site = mongoose.model('site-connection', siteSchema);

module.exports = Site;