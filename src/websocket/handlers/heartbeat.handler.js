const Tenant = require('../../models/tenant.model');
const connectionManager = require('../services/connectionManager');

const HEARTBEAT_INTERVAL = 30; // seconds

const heartbeatHandler = {
    /**
     * Handle heartbeat event from desktop client
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} data - Heartbeat data { timestamp, metrics? }
     */
    async onHeartbeat(socket, data) {
        const { site_id, tenant_id } = socket.siteData;
        const { timestamp, metrics } = data || {};

        // Update connection manager
        connectionManager.updateHeartbeat(socket);

        // Update uptime in database (increment by heartbeat interval)
        await this.incrementUptime(tenant_id, site_id, HEARTBEAT_INTERVAL);

        // Acknowledge heartbeat
        socket.emit('heartbeat_ack', {
            timestamp: timestamp,
            server_time: new Date().toISOString(),
            next_expected: Date.now() + (HEARTBEAT_INTERVAL * 1000)
        });

        // Optionally store additional metrics
        if (metrics) {
            await this.storeMetrics(tenant_id, site_id, metrics);
        }
    },

    /**
     * Increment uptime for a site
     * @param {number} tenant_id
     * @param {number} site_id
     * @param {number} seconds - Seconds to increment
     */
    async incrementUptime(tenant_id, site_id, seconds) {
        try {
            await Tenant.findOneAndUpdate(
                { tenant_id, 'sites.site_id': site_id },
                {
                    $inc: { 'sites.$.uptime': seconds },
                    $set: { 'sites.$.last_seen': new Date() }
                }
            );
        } catch (error) {
            console.error('Failed to increment uptime:', error);
        }
    },

    /**
     * Store additional metrics from desktop client
     * @param {number} tenant_id
     * @param {number} site_id
     * @param {Object} metrics - Metrics data
     */
    async storeMetrics(tenant_id, site_id, metrics) {
        // Optional: Store additional metrics like CPU, memory, etc.
        // Could write to a separate metrics collection
        console.log(`Metrics from ${tenant_id}-${site_id}:`, metrics);
    }
};

module.exports = heartbeatHandler;
