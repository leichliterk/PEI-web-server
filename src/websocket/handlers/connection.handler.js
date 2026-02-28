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

        // Register in connection manager; returns displaced entry if site was already connected
        const displaced = connectionManager.addConnection(socket);

        if (displaced) {
            console.log(`Site ${tenant_id}-${site_id} reconnected; displacing socket ${displaced.socketId}`);

            // Close the displaced socket's open session record
            const duration = Date.now() - displaced.connectedAt.getTime();
            await this.closeConnectionSession(displaced.sessionId, new Date(), duration, 'replaced_by_new_connection');

            // Mark and disconnect the old socket; its onDisconnect will skip cleanup
            const oldSocket = namespace.sockets.get(displaced.socketId);
            if (oldSocket) {
                oldSocket._displaced = true;
                oldSocket.disconnect(true);
            }
        }

        // Open a session record in MongoDB so it survives a server crash
        const { connection_source } = socket.siteData;
        const sessionId = await this.openConnectionSession(tenant_id, site_id, new Date(), connection_source);
        connectionManager.setSessionId(socket, sessionId);

        // Store the connect write promise on the socket so onDisconnect can await it.
        // This prevents a rapid disconnect from issuing its false-write before this
        // true-write completes, which would leave MongoDB permanently stuck as online.
        socket._connectReady = this.updateSiteConnectionStatus(tenant_id, site_id, true);
        await socket._connectReady;

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

        // If this socket was displaced by a new connection, its session was already
        // saved and the map entry already belongs to the new socket — skip all cleanup.
        if (socket._displaced) {
            return;
        }

        // Ensure the connect write has completed before writing disconnect.
        // Prevents out-of-order MongoDB writes on rapid connect/disconnect.
        if (socket._connectReady) {
            await socket._connectReady.catch(() => {});
        }

        // Get connection info before removing
        const connInfo = connectionManager.getConnection(tenant_id, site_id);

        // Remove from connection manager
        connectionManager.removeConnection(socket);

        // Update database: set connection_status to false
        await this.updateSiteConnectionStatus(tenant_id, site_id, false);

        // Close the session record opened on connect
        if (connInfo) {
            const sessionDuration = Date.now() - connInfo.connectedAt.getTime();
            console.log(`Session duration for ${site_name}: ${Math.round(sessionDuration / 1000)}s`);

            await this.closeConnectionSession(connInfo.sessionId, new Date(), sessionDuration, reason);
        }
    },

    /**
     * Update site connection status in database and broadcast to web clients
     * @param {number} tenant_id
     * @param {number} site_id
     * @param {boolean} status
     */
    async updateSiteConnectionStatus(tenant_id, site_id, status) {
        try {
            const lastSeen = new Date();
            await Tenant.findOneAndUpdate(
                { tenant_id, 'sites.site_id': site_id },
                {
                    $set: {
                        'sites.$.connection_status': status,
                        'sites.$.last_seen': lastSeen
                    }
                }
            );

            // Broadcast status update to subscribed web clients using a fresh
            // timestamp — more accurate than the pre-write lastSeen
            const webNs = getWebNamespace();
            if (webNs) {
                webHandler.broadcastSiteStatus(webNs, tenant_id, site_id, status, new Date());
            }
        } catch (error) {
            console.error('Failed to update connection status:', error);
        }
    },

    /**
     * Open a session record when a site connects.
     * Leaving disconnected_at/duration_ms null means it survives a server crash
     * and can be recovered on next startup.
     * @returns {*} Mongoose ObjectId of the created session, or null on error
     */
    async openConnectionSession(tenant_id, site_id, connectedAt, connectionSource) {
        try {
            const session = await ConnectionSession.create({
                tenant_id,
                site_id,
                connected_at: connectedAt,
                connection_source: connectionSource
            });
            return session._id;
        } catch (error) {
            console.error('Failed to open connection session:', error);
            return null;
        }
    },

    /**
     * Close a session record when a site disconnects (or is displaced).
     * @param {*} sessionId - Mongoose ObjectId returned by openConnectionSession
     * @param {Date} disconnectedAt
     * @param {number} durationMs
     * @param {string} disconnectReason
     */
    async closeConnectionSession(sessionId, disconnectedAt, durationMs, disconnectReason) {
        if (!sessionId) return;
        try {
            await ConnectionSession.findByIdAndUpdate(sessionId, {
                disconnected_at: disconnectedAt,
                duration_ms: durationMs,
                disconnect_reason: disconnectReason
            });
            console.log(`Session closed: ${Math.round(durationMs / 1000)}s (${disconnectReason})`);
        } catch (error) {
            console.error('Failed to close connection session:', error);
        }
    }
};

module.exports = connectionHandler;
