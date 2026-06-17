const Notification = require('../../models/notification.model');
const NotificationRule = require('../../models/notificationRule.model');
const connectionManager = require('./connectionManager');
const { getWebNamespace, getDesktopNamespace } = require('../namespaceRegistry');

/**
 * Format a Notification document for emission to a client.
 */
function format(notification) {
    return {
        id: notification._id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        data: notification.data,
        created_at: notification.created_at
    };
}

/**
 * Base filter for pending (undelivered, non-expired) notifications.
 */
function pendingFilter(extra = {}) {
    return {
        delivered_at: null,
        $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
        ...extra
    };
}

const notificationService = {
    /**
     * Send a notification to a specific site (desktop app).
     * Creates a DB record and delivers immediately if the site is connected.
     *
     * @param {number} tenant_id
     * @param {number} site_id
     * @param {Object} payload - { title, body, type?, data?, expires_at? }
     * @returns {Promise<Object>} The created Notification document
     */
    async sendToSite(tenant_id, site_id, { title, body, type = 'info', data = null, expires_at = null } = {}) {
        const notification = await Notification.create({
            recipient_type: 'site',
            tenant_id,
            site_id,
            title,
            body,
            type,
            data,
            expires_at
        });

        // Deliver immediately if site is currently connected
        const desktopNs = getDesktopNamespace();
        const connInfo = connectionManager.getConnection(tenant_id, site_id);
        if (desktopNs && connInfo) {
            const socket = desktopNs.sockets.get(connInfo.socketId);
            if (socket) {
                socket.emit('notification', format(notification));
                await Notification.findByIdAndUpdate(notification._id, { delivered_at: new Date() });
            }
        }

        return notification;
    },

    /**
     * Send a notification to a user (web + future mobile clients).
     * Creates a DB record and delivers immediately to all connected sessions.
     *
     * @param {string} auth0_id
     * @param {Object} payload - { title, body, type?, data?, expires_at? }
     * @returns {Promise<Object>} The created Notification document
     */
    async sendToUser(auth0_id, { title, body, type = 'info', data = null, expires_at = null } = {}) {
        const notification = await Notification.create({
            recipient_type: 'user',
            auth0_id,
            title,
            body,
            type,
            data,
            expires_at
        });

        // Deliver to all connected sessions for this user
        const webNs = getWebNamespace();
        if (webNs) {
            const room = `user:${auth0_id}`;
            const sockets = await webNs.in(room).fetchSockets();
            if (sockets.length > 0) {
                webNs.to(room).emit('notification', format(notification));
                await Notification.findByIdAndUpdate(notification._id, { delivered_at: new Date() });
            }
        }

        return notification;
    },

    /**
     * Push all undelivered, non-expired site notifications to a newly connected desktop socket.
     * Called from connection.handler.onConnect.
     *
     * @param {Object} socket
     * @param {number} tenant_id
     * @param {number} site_id
     */
    async deliverPendingSiteNotifications(socket, tenant_id, site_id) {
        const pending = await Notification.find(
            pendingFilter({ recipient_type: 'site', tenant_id, site_id })
        ).sort({ created_at: 1 });

        if (pending.length === 0) return;

        for (const notification of pending) {
            socket.emit('notification', format(notification));
        }

        await Notification.updateMany(
            { _id: { $in: pending.map(n => n._id) } },
            { delivered_at: new Date() }
        );

        console.log(`Delivered ${pending.length} pending notification(s) to site ${tenant_id}-${site_id}`);
    },

    /**
     * Push all undelivered, non-expired user notifications to a newly identified web socket.
     * Called from web.handler.onUserIdentify.
     *
     * @param {Object} socket
     * @param {string} auth0_id
     */
    async deliverPendingUserNotifications(socket, auth0_id) {
        const pending = await Notification.find(
            pendingFilter({ recipient_type: 'user', auth0_id })
        ).sort({ created_at: 1 });

        if (pending.length === 0) return;

        for (const notification of pending) {
            socket.emit('notification', format(notification));
        }

        await Notification.updateMany(
            { _id: { $in: pending.map(n => n._id) } },
            { delivered_at: new Date() }
        );

        console.log(`Delivered ${pending.length} pending notification(s) to user ${auth0_id}`);
    },

    /**
     * Send an online/offline notification to every user with access to the given site.
     * A user has access if their tenant_id matches AND either:
     *   - site_ids is empty (access to all sites in the tenant), or
     *   - site_ids contains the specific site_id.
     *
     * Called fire-and-forget from updateSiteConnectionStatus — errors are logged, not thrown.
     *
     * @param {number} tenant_id
     * @param {number} site_id
     * @param {string} site_name
     * @param {boolean} status - true = online, false = offline
     */
    async notifyUsersOfSiteStatus(tenant_id, site_id, site_name, status) {
        const trigger = status ? 'site_online' : 'site_offline';

        const rules = await NotificationRule.find({ tenant_id, site_id, trigger, enabled: true })
            .select('auth0_id')
            .lean();

        if (rules.length === 0) return;

        const title = status ? 'Site Online' : 'Site Offline';
        const body  = status ? `${site_name} is now online.` : `${site_name} has gone offline.`;
        const type  = status ? 'success' : 'warning';
        const data  = { tenant_id, site_id };

        // Deduplicate in case a user has multiple rules for the same event
        const auth0Ids = [...new Set(rules.map(r => r.auth0_id))];

        await Promise.all(
            auth0Ids.map(auth0_id => this.sendToUser(auth0_id, { title, body, type, data }))
        );

        console.log(`Notified ${auth0Ids.length} user(s) of ${site_name} going ${status ? 'online' : 'offline'}`);
    }
};

module.exports = notificationService;
