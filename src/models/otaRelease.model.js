const mongoose = require('mongoose');

const otaReleaseSchema = new mongoose.Schema({
    tenant_id:      { type: Number, required: true },
    version:        { type: String, required: true },
    filename:       { type: String, required: true },
    size:           { type: Number, required: true },   // bytes
    sha256:         { type: String },
    notes:          { type: String, default: '' },
    gridfs_file_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    created_by:     { type: String },                   // auth0_id of the admin
    status: {
        type: String,
        enum: ['active', 'superseded', 'archived'],
        default: 'active'
    }
}, { timestamps: true });

otaReleaseSchema.index({ tenant_id: 1, createdAt: -1 });

module.exports = mongoose.model('OtaRelease', otaReleaseSchema);
