const siteStatusCache = require('../services/siteStatusCache');
const { getWebNamespace } = require('../namespaceRegistry');

const siteManagementHandler = {
    /**
     * Desktop site reports current Windows Service state.
     * Cache it and push to any web clients watching this site.
     */
    onServiceStatus(socket, data) {
        const { tenant_id, site_id } = socket.siteData;
        const state = data?.state ?? 'unknown';

        siteStatusCache.setServiceStatus(tenant_id, site_id, state);

        const webNs = getWebNamespace();
        if (webNs) {
            webNs.to(`site:${tenant_id}:${site_id}`).emit('service:status', {
                tenant_id, site_id, state,
                updatedAt: new Date().toISOString()
            });
        }
    },

    /**
     * Desktop site reports current FTP poller state.
     * Cache it and push to any web clients watching this site.
     */
    onFtpStatus(socket, data) {
        const { tenant_id, site_id } = socket.siteData;
        const paused     = data?.paused     ?? false;
        const queueDepth = data?.queueDepth ?? 0;

        siteStatusCache.setFtpStatus(tenant_id, site_id, paused, queueDepth);

        const webNs = getWebNamespace();
        if (webNs) {
            webNs.to(`site:${tenant_id}:${site_id}`).emit('ftp:status', {
                tenant_id, site_id, paused, queueDepth,
                updatedAt: new Date().toISOString()
            });
        }
    }
};

module.exports = siteManagementHandler;
