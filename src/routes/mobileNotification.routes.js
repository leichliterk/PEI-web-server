const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
    registerToken,
    getRules,
    createRule,
    updateRule,
    editRule,
    deleteRule
} = require('../controllers/mobileNotification.controller');

const router = express.Router();

router.use(requireAuth);

router.post('/token', registerToken);

router.route('/rules')
    .get(getRules)
    .post(createRule);

router.route('/rules/:id')
    .put(editRule)
    .patch(updateRule)
    .delete(deleteRule);

module.exports = router;
