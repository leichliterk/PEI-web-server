const express = require('express');

const { about } = require('../controllers/utility.controller');
const { getAllUsers, getUser, userExists, registerUser, updateUser  } = require('../controllers/user.controller');
const { connStatus, getAllSites, getSite, getConnectionLogs, updateSiteName } = require('../controllers/site.controller');
const { getAllTenants, getTenantById } = require('../controllers/tenant.controller');

const router = express.Router();



/****************************************
 * 
 *   Utility routes
 * 
 ****************************************/

//  Returns About info
router.route('/about').get(about);

//  Records a connection status record from a site node 
router.route('/conn-status').put(connStatus);


router.route('/log-connection').post(connStatus);


/****************************************
 * 
 *   User routes
 * 
 ****************************************/

router.route('/user/users').get(getAllUsers);

router.route('/user/email/:email').get(getUser);

router.route('/user/check/:email/').get(userExists);

router.route('/user/registerUser').post(registerUser);

router.route('/user/updateUser').put(updateUser);




/****************************************
 * 
 *   Site routes
 * 
 ****************************************/

// router.route('/site/getAllSites').get(getAllSites);

// router.route('/site/getSite/:site_id').get(getSite);

// Returns the connection logs for a site node
router.route('/site/getConnectionLogs/:site_id').get(getConnectionLogs);

// Updates the name of a site
router.route('/site/updateSiteName/:tenant_id/:site_id').put(updateSiteName);



/****************************************
 *
 *   Tenant routes
 *
 ****************************************/

router.route('/tenant/getTenantById/:tenant_id').get(getTenantById);

module.exports = router;