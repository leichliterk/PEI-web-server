const PlcSnapshot = require('../../models/plcSnapshot.model');
const plcCache    = require('../services/plcCache');
const { getWebNamespace } = require('../namespaceRegistry');

const plcHandler = {
    /**
     * Received from C# desktop app every ~500ms.
     * Persists to MongoDB, caches latest, and pushes to web clients.
     */
    async onSnapshot(socket, data) {
        const { tenant_id, site_id } = socket.siteData;
        const timestamp = data?.timestamp ? new Date(data.timestamp) : new Date();
        const tags      = data?.tags ?? [];

        const snapshot = { tenant_id, site_id, timestamp, tags };

        // Persist to MongoDB (fire-and-forget — don't block the WS event loop)
        PlcSnapshot.create(snapshot).catch(err =>
            console.error(`[plc.handler] Failed to persist snapshot for ${tenant_id}-${site_id}:`, err)
        );

        // Update in-memory cache
        plcCache.setSnapshot(tenant_id, site_id, { timestamp: timestamp.toISOString(), tags });

        // Forward to web clients watching this site
        const webNs = getWebNamespace();
        if (webNs) {
            webNs.to(`site:${tenant_id}:${site_id}`).emit('plc:snapshot', {
                tenant_id, site_id, timestamp: timestamp.toISOString(), tags
            });
        }
    },

    /**
     * Received from C# when it completes a tag browse.
     * Caches the tag list and forwards to web clients.
     */
    onTags(socket, data) {
        const { tenant_id, site_id } = socket.siteData;
        const tagList = data?.tags ?? [];

        plcCache.setTags(tenant_id, site_id, tagList);

        const webNs = getWebNamespace();
        if (webNs) {
            webNs.to(`site:${tenant_id}:${site_id}`).emit('plc:tags', {
                tenant_id, site_id, tags: tagList,
                browsedAt: new Date().toISOString()
            });
        }
    }
};

module.exports = plcHandler;
