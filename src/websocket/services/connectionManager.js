// In-memory store for active connections
const activeConnections = new Map();

const connectionManager = {
    /**
     * Add a new connection
     * @param {Object} socket - Socket.io socket instance
     */
    addConnection(socket) {
        const { site_id, tenant_id, connection_source } = socket.siteData;
        const key = `${tenant_id}-${site_id}`;

        // Return any existing entry before overwriting so the caller can
        // clean up the displaced socket rather than leaving it as a ghost.
        const displaced = activeConnections.get(key) || null;

        activeConnections.set(key, {
            socketId: socket.id,
            site_id,
            tenant_id,
            connection_source,
            connectedAt: new Date(),
            sessionId: null  // set via setSessionId once the DB record is created
        });

        return displaced;
    },

    /**
     * Store the MongoDB session _id for the active connection.
     * Called after openConnectionSession resolves.
     * @param {Object} socket
     * @param {*} sessionId - Mongoose ObjectId
     */
    setSessionId(socket, sessionId) {
        const { site_id, tenant_id } = socket.siteData;
        const key = `${tenant_id}-${site_id}`;
        const entry = activeConnections.get(key);
        if (entry && entry.socketId === socket.id) {
            entry.sessionId = sessionId;
        }
    },

    /**
     * Remove a connection
     * @param {Object} socket - Socket.io socket instance
     * @returns {boolean} - Whether the connection was removed
     */
    removeConnection(socket) {
        const { site_id, tenant_id } = socket.siteData;
        const key = `${tenant_id}-${site_id}`;
        const entry = activeConnections.get(key);

        // Only delete if this socket is still the registered one.
        // Guards against a displaced old socket wiping the new socket's entry.
        if (entry && entry.socketId === socket.id) {
            return activeConnections.delete(key);
        }
        return false;
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
    },

    /**
     * Get all active connections for a tenant
     * @param {number} tenant_id
     * @returns {Array}
     */
    getConnectionsByTenant(tenant_id) {
        return Array.from(activeConnections.values()).filter(c => c.tenant_id === tenant_id);
    }
};

module.exports = connectionManager;
