const mongoose = require('mongoose');

const connectionSessionSchema = new mongoose.Schema({
    tenant_id: {
        type: Number,
        required: true,
        index: true
    },
    site_id: {
        type: Number,
        required: true,
        index: true
    },
    connected_at: {
        type: Date,
        required: true
    },
    disconnected_at: {
        type: Date,
        default: null
    },
    duration_ms: {
        type: Number,
        default: null
    },
    disconnect_reason: {
        type: String,
        default: 'unknown'
    },
    connection_source: {
        type: String,
        enum: ['app', 'service', 'unknown'],
        default: 'unknown'
    }
});

// Compound index for efficient queries by tenant/site over time ranges
connectionSessionSchema.index({ tenant_id: 1, site_id: 1, connected_at: -1 });

const ConnectionSession = mongoose.model('ConnectionSession', connectionSessionSchema);

module.exports = ConnectionSession;
