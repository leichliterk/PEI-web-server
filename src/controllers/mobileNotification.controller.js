const asyncHandler = require('express-async-handler');
const FcmToken = require('../models/fcmToken.model');
const NotificationRule = require('../models/notificationRule.model');

// Helper to format a rule document for API responses
function formatRule(rule) {
    return {
        id:               rule._id.toString(),
        tenant_id:        rule.tenant_id,
        site_id:          rule.site_id,
        site_name:        rule.site_name,
        tag_name:         rule.tag_name,
        tag_display_name: rule.tag_display_name,
        tag_unit:         rule.tag_unit ?? null,
        operator:         rule.operator,
        threshold:        rule.threshold,
        label:            rule.label ?? null,
        enabled:          rule.enabled,
        created_at:       rule.created_at
    };
}

function buildLabel(rule) {
    const operatorSymbol = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', neq: '≠' }[rule.operator] ?? rule.operator;
    const unit = rule.tag_unit ? ` ${rule.tag_unit}` : '';
    return `${rule.tag_display_name} ${operatorSymbol} ${rule.threshold}${unit}`;
}

/**
 * POST /api/notifications/token
 * Upserts the FCM device token for the authenticated user.
 */
const registerToken = asyncHandler(async (req, res) => {
    const auth0_id = req.auth.payload.sub;
    const { token, platform } = req.body;

    if (!token) {
        return res.status(400).json({ error: 'token is required' });
    }

    await FcmToken.findOneAndUpdate(
        { auth0_id },
        { token, platform: platform ?? 'android', updated_at: new Date() },
        { upsert: true }
    );

    return res.json({ ok: true });
});

/**
 * GET /api/notifications/rules
 * Returns all rules for the authenticated user.
 */
const getRules = asyncHandler(async (req, res) => {
    const auth0_id = req.auth.payload.sub;
    const rules = await NotificationRule.find({ auth0_id }).sort({ created_at: -1 }).lean();
    return res.json(rules.map(formatRule));
});

/**
 * POST /api/notifications/rules
 * Creates a new rule for the authenticated user.
 */
const createRule = asyncHandler(async (req, res) => {
    const auth0_id = req.auth.payload.sub;
    const { tenant_id, site_id, site_name, tag_name, tag_display_name, tag_unit, operator, threshold } = req.body;

    const OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];

    if (!tenant_id || !site_id || !site_name || !tag_name || !tag_display_name || !operator || threshold === undefined) {
        return res.status(400).json({ error: 'tenant_id, site_id, site_name, tag_name, tag_display_name, operator, and threshold are required' });
    }
    if (!OPERATORS.includes(operator)) {
        return res.status(400).json({ error: `operator must be one of: ${OPERATORS.join(', ')}` });
    }

    const ruleData = {
        auth0_id,
        tenant_id: parseInt(tenant_id),
        site_id,
        site_name,
        tag_name,
        tag_display_name,
        tag_unit:  tag_unit ?? null,
        operator,
        threshold: parseFloat(threshold)
    };
    ruleData.label = buildLabel(ruleData);

    const rule = await NotificationRule.create(ruleData);
    return res.status(201).json(formatRule(rule));
});

/**
 * PATCH /api/notifications/rules/:id
 * Enables or disables a rule.
 */
const updateRule = asyncHandler(async (req, res) => {
    const auth0_id = req.auth.payload.sub;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    const rule = await NotificationRule.findOneAndUpdate(
        { _id: req.params.id, auth0_id },
        { enabled }
    );

    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    return res.json({ ok: true });
});

/**
 * DELETE /api/notifications/rules/:id
 */
const deleteRule = asyncHandler(async (req, res) => {
    const auth0_id = req.auth.payload.sub;

    const rule = await NotificationRule.findOneAndDelete({ _id: req.params.id, auth0_id });

    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    return res.json({ ok: true });
});

module.exports = { registerToken, getRules, createRule, updateRule, deleteRule };
