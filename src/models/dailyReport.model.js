const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema({
    tenant_id:  { type: Number, required: true },
    site_id:    { type: String, required: true },
    date_key:   { type: String, required: true },
    credits:    { type: Number, default: null },
    uptime:     { type: Number, default: 0 }
}, { collection: 'dailyreports', timestamps: false });

dailyReportSchema.index({ tenant_id: 1, date_key: 1, site_id: 1 }, { unique: true });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
