const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getStatus, serviceCommand, ftpCommand } = require('../controllers/siteManagement.controller');

const router = express.Router();

// All site-management routes require admin role
router.use(requireAuth, requireAdmin);

// GET  /:tenant_id/:site_id/status
router.get('/:tenant_id/:site_id/status', getStatus);

// POST /:tenant_id/:site_id/service/:action  (stop|start|restart)
router.post('/:tenant_id/:site_id/service/:action', serviceCommand);

// POST /:tenant_id/:site_id/ftp/:action  (pause|resume|full-upload)
router.post('/:tenant_id/:site_id/ftp/:action', ftpCommand);

module.exports = router;
