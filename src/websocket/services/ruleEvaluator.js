const NotificationRule = require('../../models/notificationRule.model');
const FcmToken = require('../../models/fcmToken.model');
const fcm = require('../../services/fcm.service');
const notificationService = require('./notificationService');

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// Debounce state keyed by rule _id string
// { [ruleId]: { conditionActive: boolean, lastFiredAt: number } }
const debounceState = new Map();

const OPERATORS = {
    gt:  (v, t) => v >  t,
    gte: (v, t) => v >= t,
    lt:  (v, t) => v <  t,
    lte: (v, t) => v <= t,
    eq:  (v, t) => v === t,
    neq: (v, t) => v !== t
};

/**
 * Evaluate all enabled rules for the given site against the incoming snapshot tags.
 * Called from plc.handler.js on every plc:snapshot event.
 *
 * @param {number} tenant_id
 * @param {number} site_id
 * @param {Array}  tags  - array of { name, value, error, displayName, unit, ... }
 */
async function evaluate(tenant_id, site_id, tags) {
    let rules;
    try {
        rules = await NotificationRule.find({ tenant_id, site_id, enabled: true, trigger: 'plc_tag' }).lean();
    } catch (err) {
        console.error('[ruleEvaluator] Failed to load rules:', err.message);
        return;
    }

    if (rules.length === 0) return;

    // Build a tag lookup map for O(1) access
    const tagMap = new Map(tags.map(t => [t.name, t]));

    const now = Date.now();

    for (const rule of rules) {
        const ruleId = rule._id.toString();
        const tag = tagMap.get(rule.tag_name);

        // Tag missing or in error — clear active state so it re-fires if it recovers
        if (!tag || tag.error) {
            const state = debounceState.get(ruleId);
            if (state) state.conditionActive = false;
            continue;
        }

        const evaluate = OPERATORS[rule.operator];
        if (!evaluate) continue;

        const conditionMet = evaluate(tag.value, rule.threshold);

        const state = debounceState.get(ruleId) ?? { conditionActive: false, lastFiredAt: 0 };

        if (conditionMet) {
            const cooldownExpired = (now - state.lastFiredAt) >= COOLDOWN_MS;
            const shouldFire = !state.conditionActive || cooldownExpired;

            if (shouldFire) {
                state.conditionActive = true;
                state.lastFiredAt = now;
                debounceState.set(ruleId, state);

                // Fire-and-forget — don't await inside the loop
                sendAlert(rule, tag);
            } else {
                debounceState.set(ruleId, state);
            }
        } else {
            // Condition cleared — reset so it fires again on next trigger
            state.conditionActive = false;
            debounceState.set(ruleId, state);
        }
    }
}

async function sendAlert(rule, tag) {
    const ruleId = rule._id.toString();
    const operatorSymbol = { gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=', neq: '≠' }[rule.operator] ?? rule.operator;
    const unit = rule.tag_unit ? ` ${rule.tag_unit}` : '';
    const body  = `${rule.tag_display_name} ${operatorSymbol} ${rule.threshold}${unit} (currently ${tag.value}${unit})`;

    console.log(`[ruleEvaluator] Rule triggered | rule=${ruleId} user=${rule.auth0_id} site=${rule.tenant_id}-${rule.site_id} condition="${body}"`);

    const fcmToken = await FcmToken.findOne({ auth0_id: rule.auth0_id }).lean();
    if (!fcmToken) {
        console.warn(`[ruleEvaluator] No FCM token for user ${rule.auth0_id} — push skipped`);
        return;
    }

    const title = `PEI Alert — ${rule.site_name}`;

    // Send to web app
    await notificationService.sendToUser(rule.auth0_id, {
        title,
        body,
        type: 'warning',
        data: { site_id: String(rule.site_id), tag_name: rule.tag_name, rule_id: ruleId, value: String(tag.value) }
    }).catch(err => console.error(`[ruleEvaluator] Web notification failed | user=${rule.auth0_id} error="${err.message}"`));

    try {
        await fcm.sendPush(fcmToken.token, title, body, {
            site_id:  String(rule.site_id),
            tag_name: rule.tag_name,
            rule_id:  ruleId,
            value:    String(tag.value)
        });
        console.log(`[ruleEvaluator] Push sent | user=${rule.auth0_id} token=${fcmToken.token.slice(0, 20)}... msg="${body}"`);
    } catch (err) {
        console.error(`[ruleEvaluator] Push failed | user=${rule.auth0_id} rule=${ruleId} error="${err.message}"`);
    }
}

module.exports = { evaluate };
