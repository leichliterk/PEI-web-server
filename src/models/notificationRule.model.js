const mongoose = require('mongoose');

const OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];
const TRIGGERS  = ['plc_tag', 'site_online', 'site_offline'];

const notificationRuleSchema = new mongoose.Schema({
    auth0_id:         { type: String, required: true },
    tenant_id:        { type: Number, required: true },
    site_id:          { type: String, required: true },
    site_name:        { type: String, required: true },
    trigger:          { type: String, required: true, enum: TRIGGERS, default: 'plc_tag' },
    // plc_tag fields — only required when trigger === 'plc_tag'
    tag_name:         { type: String, default: null },
    tag_display_name: { type: String, default: null },
    tag_unit:         { type: String, default: null },
    operator:         { type: String, enum: [...OPERATORS, null], default: null },
    threshold:        { type: Number, default: null },
    label:            { type: String },
    enabled:          { type: Boolean, default: true }
}, { collection: 'notificationrules', timestamps: { createdAt: 'created_at', updatedAt: false } });

// Index for fast lookup during plc:snapshot evaluation
notificationRuleSchema.index({ tenant_id: 1, site_id: 1, enabled: 1 });
// Index for user-facing CRUD
notificationRuleSchema.index({ auth0_id: 1 });

module.exports = mongoose.model('NotificationRule', notificationRuleSchema);
