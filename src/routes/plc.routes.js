const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getLatest, getSnapshots, getTags } = require('../controllers/plc.controller');

const router = express.Router();

// All PLC routes require authentication (any authenticated user)
router.use(requireAuth);

router.get('/:tenant_id/:site_id/latest',    getLatest);
router.get('/:tenant_id/:site_id/snapshots', getSnapshots);
router.get('/:tenant_id/:site_id/tags',      getTags);

module.exports = router;
