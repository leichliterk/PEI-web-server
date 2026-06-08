const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient_type: {
        type: String,
        enum: ['site', 'user'],
        required: true
    },

    // Site recipient fields
    tenant_id: {
        type: Number,
        default: null
    },
    site_id: {
        type: String,
        default: null
    },

    // User recipient field
    auth0_id: {
        type: String,
        default: null
    },

    // Content
    title: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['info', 'warning', 'error', 'success'],
        default: 'info'
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Lifecycle
    created_at: {
        type: Date,
        default: () => new Date()
    },
    expires_at: {
        type: Date,
        default: null
    },
    read_at: {
        type: Date,
        default: null     // null = unread
    },
    delivered_at: {
        type: Date,
        default: null     // null = not yet pushed to client
    }
});

// Efficient queries by user inbox (unread filter)
notificationSchema.index({ auth0_id: 1, read_at: 1, created_at: -1 });

// Efficient queries by site inbox (unread filter)
notificationSchema.index({ tenant_id: 1, site_id: 1, read_at: 1, created_at: -1 });

// TTL index — MongoDB auto-deletes expired, delivered notifications after 30 days
// (expires_at null documents are not affected by this index)
notificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expires_at: { $ne: null } } });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
