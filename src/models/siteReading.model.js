const mongoose = require('mongoose');

// Points to the pre-existing time-series collection "sitereadings".
// Deduplication is handled at the application layer (time-series collections
// do not support unique indexes).
const siteReadingSchema = new mongoose.Schema({
    timestamp:      { type: Date,   required: true },
    date_key:       { type: String, required: true },
    tenant_id:      { type: Number, required: true },
    site_id:        { type: String, required: true },
    flr_flow:       { type: Number },
    flr_temp_50x:   { type: Number },
    flr_temp_502:   { type: Number },
    inlet_pressure: { type: Number },
    o2:             { type: Number },
    ch4:            { type: Number },
    flr_sdv:        { type: Number }
// strict: false allows dynamic measurement columns — LineTrendGraph files contain
// site-specific PLC tag names that vary per site configuration.
}, { collection: 'sitereadings', strict: false });

module.exports = mongoose.model('SiteReading', siteReadingSchema);
