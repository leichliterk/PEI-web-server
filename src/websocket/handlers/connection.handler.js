const Tenant = require('../../models/tenant.model');
const ConnectionSession = require('../../models/connectionSession.model');
const connectionManager = require('../services/connectionManager');
const webHandler = require('./web.handler');
const { getWebNamespace } = require('../namespaceRegistry');

const connectionHandler = {
    /**
     * Handle new socket connection
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} namespace - Socket.io namespace
     */
    async onConnect(socket, namespace) {
        const { site_id, tenant_id, site_name } = socket.siteData;

        console.log(`Site connected: ${site_name} (${tenant_id}-${site_id})`);

        // Register in connection manager
        connectionManager.addConnection(socket);

        // Update database: set connection_status to true
        await this.updateSiteConnectionStatus(tenant_id, site_id, true);

        // Emit confirmation
        socket.emit('authenticated', {
            success: true,
            message: 'Connected successfully',
            server_time: new Date().toISOString()
        });
    },

    /**
     * Handle socket disconnection
     * @param {Object} socket - Socket.io socket instance
     * @param {string} reason - Disconnect reason
     */
    async onDisconnect(socket, reason) {
        const { site_id, tenant_id, site_name } = socket.siteData;

        console.log(`Site disconnected: ${site_name} (${tenant_id}-${site_id}), reason: ${reason}`);

        // Get connection info before removing
        const connInfo = connectionManager.getConnection(tenant_id, site_id);

        // Remove from connection manager
        connectionManager.removeConnection(socket);

        // Update database: set connection_status to false
        await this.updateSiteConnectionStatus(tenant_id, site_id, false);

        // Save session record
        if (connInfo) {
            const sessionDuration = Date.now() - connInfo.connectedAt.getTime();
            console.log(`Session duration for ${site_name}: ${Math.round(sessionDuration / 1000)}s`);

            await this.saveConnectionSession(tenant_id, site_id, connInfo.connectedAt, reason, sessionDuration);
        }
    },

    /**
     * Handle manual status updates from desktop app
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} data - Status data
     */
    async onStatusUpdate(socket, data) {
        const { site_id, tenant_id } = socket.siteData;
        console.log(`Status update from ${tenant_id}-${site_id}:`, data);
    },

    /**
     * Update site connection status in database and broadcast to web clients
     * @param {number} tenant_id
     * @param {number} site_id
     * @param {boolean} status
     */
    async updateSiteConnectionStatus(tenant_id, site_id, status) {
        const lastSeen = new Date();

        try {
            await Tenant.findOneAndUpdate(
                { tenant_id, 'sites.site_id': site_id },
                {
                    $set: {
                        'sites.$.connection_status': status,
                        'sites.$.last_seen': lastSeen
                    }
                }
            );

            // Broadcast status update to subscribed web clients
            const webNs = getWebNamespace();
            if (webNs) {
                webHandler.broadcastSiteStatus(webNs, tenant_id, site_id, status, lastSeen);
            }
        } catch (error) {
            console.error('Failed to update connection status:', error);
        }
    },

    /**
     * Save connection session record for uptime tracking
     * @param {number} tenant_id
     * @param {number} site_id
     * @param {Date} connectedAt
     * @param {string} disconnectReason
     * @param {number} durationMs
     */
    async saveConnectionSession(tenant_id, site_id, connectedAt, disconnectReason, durationMs) {
        try {
            await ConnectionSession.create({
                tenant_id,
                site_id,
                connected_at: connectedAt,
                disconnected_at: new Date(),
                duration_ms: durationMs,
                disconnect_reason: disconnectReason
            });
            console.log(`Session saved for ${tenant_id}-${site_id}: ${Math.round(durationMs / 1000)}s`);
        } catch (error) {
            console.error('Failed to save connection session:', error);
        }
    }
};

module.exports = connectionHandler;
