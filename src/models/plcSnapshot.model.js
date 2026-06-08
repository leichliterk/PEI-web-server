const mongoose = require('mongoose');

const plcSnapshotSchema = new mongoose.Schema({
    tenant_id: { type: Number, required: true },
    site_id:   { type: String, required: true },
    timestamp: { type: Date,   required: true },
    tags: [{
        name:  { type: String },
        value: { type: mongoose.Schema.Types.Mixed },
        error: { type: String, default: null }
    }]
}, { collection: 'plcsnapshots', timestamps: false });

plcSnapshotSchema.index({ tenant_id: 1, site_id: 1, timestamp: -1 });

module.exports = mongoose.model('PlcSnapshot', plcSnapshotSchema);
