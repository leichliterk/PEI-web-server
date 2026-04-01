const mongoose = require('mongoose');

const otaReleaseResponseSchema = new mongoose.Schema({
    release_id:        { type: mongoose.Schema.Types.ObjectId, ref: 'OtaRelease', required: true },
    tenant_id:         { type: Number, required: true },
    site_id:           { type: Number, required: true },
    accepted:          { type: Boolean, required: true },
    responded_at:      { type: Date, default: Date.now },
    installed_at:      { type: Date },
    installed_version: { type: String }
}, { timestamps: false });

// One response record per release+site; upserted on each response/install event
otaReleaseResponseSchema.index({ release_id: 1, tenant_id: 1, site_id: 1 }, { unique: true });

module.exports = mongoose.model('OtaReleaseResponse', otaReleaseResponseSchema);
