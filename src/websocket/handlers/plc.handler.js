const plcCache    = require('../services/plcCache');
const { getWebNamespace } = require('../namespaceRegistry');
const SiteReading = require('../../models/siteReading.model');

const plcHandler = {
    /**
     * Received from C# desktop app every ~500ms.
     * Caches latest and pushes to web clients — not persisted to MongoDB.
     */
    onSnapshot(socket, data) {
        const { tenant_id, site_id } = socket.siteData;
        const timestamp = data?.timestamp ? new Date(data.timestamp) : new Date();
        const tags      = data?.tags ?? [];

        console.log(`[plc:snapshot] tenant=${tenant_id} site=${site_id} tags=${tags.length} ts=${timestamp.toISOString()}`);

        // Flatten tags to a plain object and persist to sitereadings (fire-and-forget)
        const tagData = {};
        for (const tag of tags) {
            if (tag.name && tag.error == null) {
                const key = tag.name.toLowerCase()
                    .replace(/[.\s]+/g, '_')
                    .replace(/[^a-z0-9_]/g, '')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/, '');
                tagData[key] = tag.value;
            }
        }
        SiteReading.create({
            tenant_id, site_id, timestamp,
            date_key: timestamp.toISOString().slice(0, 10),
            ...tagData
        }).catch(err => console.error(`[plc.handler] Failed to persist reading for ${tenant_id}-${site_id}:`, err));

        // Update in-memory cache
        plcCache.setSnapshot(tenant_id, site_id, { timestamp: timestamp.toISOString(), tags });

        // Forward to web clients watching this site
        const webNs = getWebNamespace();
        if (webNs) {
            const room   = `site:${tenant_id}:${site_id}`;
            const sockets = webNs.adapter.rooms.get(room);
            const count   = sockets ? sockets.size : 0;
            console.log(`[plc:snapshot] → emitting to room "${room}" (${count} web client(s))`);
            webNs.to(room).emit('plc:snapshot', {
                tenant_id, site_id, timestamp: timestamp.toISOString(), tags
            });
        } else {
            console.warn('[plc:snapshot] web namespace not available');
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
