const Tenant = require('../../models/tenant.model');
const Notification = require('../../models/notification.model');
const notificationService = require('../services/notificationService');

const webHandler = {
    /**
     * Handle new web client connection
     * @param {Object} socket - Socket.io socket instance
     */
    onConnect(socket) {
        console.log(`Web client connected: ${socket.id}`);
    },

    /**
     * Handle web client subscribing to a tenant's updates
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} data - Subscription data { tenant_id }
     */
    async onSubscribeTenant(socket, data) {
        const { tenant_id } = data;

        if (!tenant_id) {
            socket.emit('error', { message: 'tenant_id is required' });
            return;
        }

        const tenantIdNum = parseInt(tenant_id);
        const room = `tenant:${tenantIdNum}`;

        socket.join(room);
        console.log(`Web client ${socket.id} subscribed to tenant ${tenantIdNum}`);
        socket.emit('subscribed', { tenant_id: tenantIdNum });

        // Send snapshot from MongoDB — shared state across all server instances
        try {
            const tenant = await Tenant.findOne({ tenant_id: tenantIdNum });
            const now = new Date().toISOString();
            const snapshot = tenant
                ? tenant.sites.map(s => ({
                    site_id: s.site_id,
                    connection_status: s.connection_status === true,
                    // For online sites, last_seen is now — they're demonstrably alive
                    last_seen: s.connection_status === true ? now : (s.last_seen ? s.last_seen.toISOString() : null)
                }))
                : [];
            socket.emit('site:status_snapshot', { tenant_id: tenantIdNum, sites: snapshot });
        } catch (error) {
            console.error(`Failed to send snapshot for tenant ${tenantIdNum}:`, error);
        }
    },

    /**
     * Handle web client unsubscribing from a tenant
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} data - Unsubscription data { tenant_id }
     */
    onUnsubscribeTenant(socket, data) {
        const { tenant_id } = data;
        const tenantIdNum = parseInt(tenant_id);
        socket.leave(`tenant:${tenantIdNum}`);
        console.log(`Web client ${socket.id} unsubscribed from tenant ${tenantIdNum}`);
    },

    /**
     * Handle web client disconnection
     * @param {Object} socket - Socket.io socket instance
     * @param {string} reason - Disconnect reason
     */
    onDisconnect(socket, reason) {
        console.log(`Web client disconnected: ${socket.id}, reason: ${reason}`);
    },

    /**
     * Handle user identification from a web (or future mobile) client.
     * Joins the per-user room and delivers any pending notifications.
     * @param {Object} socket
     * @param {Object} data - { auth0_id }
     */
    async onUserIdentify(socket, data) {
        const { auth0_id } = data || {};

        if (!auth0_id) {
            socket.emit('error', { message: 'auth0_id is required' });
            return;
        }

        socket.auth0_id = auth0_id;
        socket.join(`user:${auth0_id}`);
        console.log(`Web client ${socket.id} identified as user ${auth0_id}`);

        await notificationService.deliverPendingUserNotifications(socket, auth0_id);
    },

    /**
     * Handle a web client marking a notification as read.
     * @param {Object} socket
     * @param {Object} data - { notification_id }
     */
    async onNotificationRead(socket, data) {
        const { notification_id } = data || {};

        if (!notification_id) {
            socket.emit('error', { message: 'notification_id is required' });
            return;
        }

        try {
            const result = await Notification.findOneAndUpdate(
                {
                    _id: notification_id,
                    recipient_type: 'user',
                    auth0_id: socket.auth0_id,  // ensure the notification belongs to this user
                    read_at: null
                },
                { read_at: new Date() }
            );

            if (!result) {
                socket.emit('error', { message: 'Notification not found or already read' });
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    },

    /**
     * Broadcast site status update to all web clients subscribed to the tenant
     * @param {Object} webNamespace - Socket.io namespace for web clients
     * @param {number} tenant_id
     * @param {number} site_id
     * @param {boolean} connection_status
     * @param {Date} last_seen
     */
    broadcastSiteStatus(webNamespace, tenant_id, site_id, connection_status, last_seen) {
        const message = {
            type: 'site_status_update',
            site_id,
            connection_status,
            last_seen: last_seen.toISOString()
        };
        webNamespace.to(`tenant:${tenant_id}`).emit('site_status_update', message);
        console.log(`Broadcasted status update for site ${site_id} to tenant ${tenant_id} subscribers`);
    }
};

module.exports = webHandler;
