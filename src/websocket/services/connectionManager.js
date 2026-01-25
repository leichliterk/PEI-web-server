// In-memory store for active connections
const activeConnections = new Map();

const connectionManager = {
    /**
     * Add a new connection
     * @param {Object} socket - Socket.io socket instance
     */
    addConnection(socket) {
        const { site_id, tenant_id } = socket.siteData;
        const key = `${tenant_id}-${site_id}`;

        activeConnections.set(key, {
            socketId: socket.id,
            site_id,
            tenant_id,
            connectedAt: new Date(),
            lastHeartbeat: new Date()
        });
    },

    /**
     * Remove a connection
     * @param {Object} socket - Socket.io socket instance
     * @returns {boolean} - Whether the connection was removed
     */
    removeConnection(socket) {
        const { site_id, tenant_id } = socket.siteData;
        const key = `${tenant_id}-${site_id}`;
        return activeConnections.delete(key);
    },

    /**
     * Update heartbeat timestamp for a connection
     * @param {Object} socket - Socket.io socket instance
     */
    updateHeartbeat(socket) {
        const { site_id, tenant_id } = socket.siteData;
        const key = `${tenant_id}-${site_id}`;
        const conn = activeConnections.get(key);

        if (conn) {
            conn.lastHeartbeat = new Date();
        }
    },

    /**
     * Get connection info for a site
     * @param {number} tenant_id
     * @param {number} site_id
     * @returns {Object|undefined}
     */
    getConnection(tenant_id, site_id) {
        const key = `${tenant_id}-${site_id}`;
        return activeConnections.get(key);
    },

    /**
     * Get all active connections
     * @returns {Array}
     */
    getAllConnections() {
        return Array.from(activeConnections.values());
    },

    /**
     * Check if a site is currently connected
     * @param {number} tenant_id
     * @param {number} site_id
     * @returns {boolean}
     */
    isConnected(tenant_id, site_id) {
        const key = `${tenant_id}-${site_id}`;
        return activeConnections.has(key);
    }
};

module.exports = connectionManager;
