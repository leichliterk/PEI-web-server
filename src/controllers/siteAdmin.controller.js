const asyncHandler = require('express-async-handler');
const Tenant = require('../models/tenant.model');

const VALID_STATUSES = ['offline', 'testing', 'production'];

function findSite(tenant, site_id) {
    return (tenant.sites || []).find(s => s.site_id === site_id);
}

/**
 * GET /api/data/site-admin/:tenant_id/sites?includeArchived=true|false
 */
const listSites = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const includeArchived = req.query.includeArchived === 'true';

    const tenant = await Tenant.findOne({ tenant_id: tenantId }).lean();
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const sites = (tenant.sites || []).filter(s => includeArchived || !s.archived);
    return res.json(sites);
});

/**
 * POST /api/data/site-admin/:tenant_id/sites
 * Body: { site_id: string, name: string }
 */
const createSite = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const { site_id, name } = req.body;

    if (!site_id || !name) {
        return res.status(400).json({ error: 'site_id and name are required' });
    }

    const tenant = await Tenant.findOne({ tenant_id: tenantId });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    if (findSite(tenant, site_id)) {
        return res.status(400).json({ error: `Site with site_id '${site_id}' already exists` });
    }

    const newSite = {
        site_id,
        name,
        status: 'offline',
        archived: false,
        carb_certified: false,
        connection_status: false
    };

    tenant.sites.push(newSite);
    tenant.markModified('sites');
    await tenant.save();

    return res.status(201).json(newSite);
});

/**
 * PATCH /api/data/site-admin/:tenant_id/sites/:site_id
 * Body: { name: string }
 */
const updateSite = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const { site_id } = req.params;
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const tenant = await Tenant.findOneAndUpdate(
        { tenant_id: tenantId, 'sites.site_id': site_id },
        { $set: { 'sites.$.name': name } },
        { new: true }
    ).lean();

    if (!tenant) return res.status(404).json({ error: 'Tenant or site not found' });

    return res.json(findSite(tenant, site_id));
});

/**
 * PATCH /api/data/site-admin/:tenant_id/sites/:site_id/status
 * Body: { status: 'offline' | 'testing' | 'production' }
 */
const setSiteStatus = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const { site_id } = req.params;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const tenant = await Tenant.findOneAndUpdate(
        { tenant_id: tenantId, 'sites.site_id': site_id },
        { $set: { 'sites.$.status': status } },
        { new: true }
    ).lean();

    if (!tenant) return res.status(404).json({ error: 'Tenant or site not found' });

    return res.json(findSite(tenant, site_id));
});

/**
 * PATCH /api/data/site-admin/:tenant_id/sites/:site_id/carb
 * Body: { carb_certified: boolean }
 */
const setCarbCertified = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const { site_id } = req.params;
    const { carb_certified } = req.body;

    if (typeof carb_certified !== 'boolean') {
        return res.status(400).json({ error: 'carb_certified must be a boolean' });
    }

    const tenant = await Tenant.findOneAndUpdate(
        { tenant_id: tenantId, 'sites.site_id': site_id },
        { $set: { 'sites.$.carb_certified': carb_certified } },
        { new: true }
    ).lean();

    if (!tenant) return res.status(404).json({ error: 'Tenant or site not found' });

    return res.json(findSite(tenant, site_id));
});

/**
 * PATCH /api/data/site-admin/:tenant_id/sites/:site_id/archive
 */
const archiveSite = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const { site_id } = req.params;

    const tenant = await Tenant.findOneAndUpdate(
        { tenant_id: tenantId, 'sites.site_id': site_id },
        { $set: { 'sites.$.archived': true } },
        { new: true }
    ).lean();

    if (!tenant) return res.status(404).json({ error: 'Tenant or site not found' });

    return res.json(findSite(tenant, site_id));
});

/**
 * DELETE /api/data/site-admin/:tenant_id/sites/:site_id
 */
const deleteSite = asyncHandler(async (req, res) => {
    const tenantId = parseInt(req.params.tenant_id);
    const { site_id } = req.params;

    const tenant = await Tenant.findOneAndUpdate(
        { tenant_id: tenantId },
        { $pull: { sites: { site_id } } },
        { new: true }
    ).lean();

    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    return res.json({ message: 'Site deleted' });
});

module.exports = { listSites, createSite, updateSite, setSiteStatus, setCarbCertified, archiveSite, deleteSite };
