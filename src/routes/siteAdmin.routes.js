const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
    listSites, createSite, updateSite, setSiteStatus,
    setCarbCertified, archiveSite, deleteSite
} = require('../controllers/siteAdmin.controller');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get( '/:tenant_id/sites',                   listSites);
router.post('/:tenant_id/sites',                   createSite);
router.patch('/:tenant_id/sites/:site_id',         updateSite);
router.patch('/:tenant_id/sites/:site_id/status',  setSiteStatus);
router.patch('/:tenant_id/sites/:site_id/carb',    setCarbCertified);
router.patch('/:tenant_id/sites/:site_id/archive', archiveSite);
router.delete('/:tenant_id/sites/:site_id',        deleteSite);

module.exports = router;
