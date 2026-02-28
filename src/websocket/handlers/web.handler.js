const connectionManager = require('../services/connectionManager');

// Track web client subscriptions: Map<socket.id, Set<tenant_id>>
const clientSubscriptions = new Map();

const webHandler = {
    /**
     * Handle new web client connection
     * @param {Object} socket - Socket.io socket instance
     */
    onConnect(socket) {
        console.log(`Web client connected: ${socket.id}`);
        clientSubscriptions.set(socket.id, new Set());
    },

    /**
     * Handle web client subscribing to a tenant's updates
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} data - Subscription data { tenant_id }
     */
    onSubscribeTenant(socket, data) {
        const { tenant_id } = data;

        if (!tenant_id) {
            socket.emit('error', { message: 'tenant_id is required' });
            return;
        }

        const tenantIdNum = parseInt(tenant_id);
        const subscriptions = clientSubscriptions.get(socket.id);

        if (subscriptions) {
            subscriptions.add(tenantIdNum);
            console.log(`Web client ${socket.id} subscribed to tenant ${tenantIdNum}`);
            socket.emit('subscribed', { tenant_id: tenantIdNum });

            // Send a snapshot of all currently active connections for this tenant
            const activeConnections = connectionManager.getConnectionsByTenant(tenantIdNum);
            const snapshot = activeConnections.map(c => ({
                site_id: c.site_id,
                connection_status: true,
                last_seen: c.lastHeartbeat.toISOString()
            }));
            socket.emit('site:status_snapshot', { tenant_id: tenantIdNum, sites: snapshot });
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
        const subscriptions = clientSubscriptions.get(socket.id);

        if (subscriptions) {
            subscriptions.delete(tenantIdNum);
            console.log(`Web client ${socket.id} unsubscribed from tenant ${tenantIdNum}`);
        }
    },

    /**
     * Handle web client disconnection
     * @param {Object} socket - Socket.io socket instance
     * @param {string} reason - Disconnect reason
     */
    onDisconnect(socket, reason) {
        console.log(`Web client disconnected: ${socket.id}, reason: ${reason}`);
        clientSubscriptions.delete(socket.id);
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

        // Find all sockets subscribed to this tenant
        for (const [socketId, subscriptions] of clientSubscriptions.entries()) {
            if (subscriptions.has(tenant_id)) {
                const socket = webNamespace.sockets.get(socketId);
                if (socket) {
                    socket.emit('site_status_update', message);
                }
            }
        }

        console.log(`Broadcasted status update for site ${site_id} to tenant ${tenant_id} subscribers`);
    }
};

module.exports = webHandler;
