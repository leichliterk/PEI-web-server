// In-memory cache of latest PLC snapshot and tag list per site.
// Keyed by "tenant_id:site_id".
const snapshots = new Map();
const tags      = new Map();

function _key(tenant_id, site_id) {
    return `${tenant_id}:${site_id}`;
}

const plcCache = {
    setSnapshot(tenant_id, site_id, snapshot) {
        snapshots.set(_key(tenant_id, site_id), snapshot);
    },

    getSnapshot(tenant_id, site_id) {
        return snapshots.get(_key(tenant_id, site_id)) ?? null;
    },

    setTags(tenant_id, site_id, tagList) {
        tags.set(_key(tenant_id, site_id), { tags: tagList, browsedAt: new Date().toISOString() });
    },

    getTags(tenant_id, site_id) {
        return tags.get(_key(tenant_id, site_id)) ?? null;
    }
};

module.exports = plcCache;
