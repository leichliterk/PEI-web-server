const express = require('express');

const { about } = require('../controllers/utility.controller');
const { getAllUsers, getUser, userExists, registerUser, updateUser  } = require('../controllers/user.controller');
const { updateSiteName, getConnectionUptime } = require('../controllers/site.controller');
const { getTenantById } = require('../controllers/tenant.controller');
const { getSiteFiles, downloadFile } = require('../controllers/file.controller');

const router = express.Router();



/****************************************
 * 
 *   Utility routes
 * 
 ****************************************/

//  Returns About info
router.route('/about').get(about);




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

// Updates the name of a site
router.route('/site/updateSiteName/:tenant_id/:site_id').put(updateSiteName);

// Get connection uptime for a site
router.route('/site/uptime/:tenant_id/:site_id').get(getConnectionUptime);



/****************************************
 *
 *   File routes
 *
 ****************************************/

// List files for a site
router.route('/files/:tenant_id/:site_id').get(getSiteFiles);

// Download a file by ID
router.route('/files/download/:file_id').get(downloadFile);



/****************************************
 *
 *   Tenant routes
 *
 ****************************************/

router.route('/tenant/getTenantById/:tenant_id').get(getTenantById);

module.exports = router;