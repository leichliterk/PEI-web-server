// In-memory cache of last known service and FTP status per site.
// Keyed by "tenant_id:site_id".
const cache = new Map();

function _key(tenant_id, site_id) {
    return `${tenant_id}:${site_id}`;
}

const siteStatusCache = {
    setServiceStatus(tenant_id, site_id, state) {
        const k = _key(tenant_id, site_id);
        const entry = cache.get(k) || {};
        cache.set(k, { ...entry, service: { state, updatedAt: new Date().toISOString() } });
    },

    setFtpStatus(tenant_id, site_id, paused, queueDepth) {
        const k = _key(tenant_id, site_id);
        const entry = cache.get(k) || {};
        cache.set(k, { ...entry, ftp: { paused, queueDepth, updatedAt: new Date().toISOString() } });
    },

    getStatus(tenant_id, site_id) {
        return cache.get(_key(tenant_id, site_id)) || {};
    },

    clearSite(tenant_id, site_id) {
        cache.delete(_key(tenant_id, site_id));
    }
};

module.exports = siteStatusCache;
