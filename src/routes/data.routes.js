const express = require('express');

const { about } = require('../controllers/utility.controller');
const { getAllUsers, getUser, userExists, registerUser, updateUser  } = require('../controllers/user.controller');
const { updateSiteName, getConnectionUptime } = require('../controllers/site.controller');
const { getTenantById } = require('../controllers/tenant.controller');
const { getSiteFiles, downloadFile } = require('../controllers/file.controller');
const {
    getUserNotifications,
    getSiteNotifications,
    markNotificationRead,
    markAllUserNotificationsRead,
    markAllSiteNotificationsRead
} = require('../controllers/notification.controller');

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

// Download a file by ID
router.route('/files/download/:file_id').get(downloadFile);

// List files for a site
router.route('/files/:tenant_id/:site_id').get(getSiteFiles);



/****************************************
 *
 *   Notification routes
 *
 ****************************************/

// List notifications for a user
router.route('/notifications/user/:auth0_id').get(getUserNotifications);

// Mark all notifications for a user as read
router.route('/notifications/user/:auth0_id/read-all').post(markAllUserNotificationsRead);

// List notifications for a site
router.route('/notifications/site/:tenant_id/:site_id').get(getSiteNotifications);

// Mark all notifications for a site as read
router.route('/notifications/site/:tenant_id/:site_id/read-all').post(markAllSiteNotificationsRead);

// Mark a single notification as read (must come before /:id catch-all if added later)
router.route('/notifications/:id/read').patch(markNotificationRead);



/****************************************
 *
 *   Tenant routes
 *
 ****************************************/

router.route('/tenant/getTenantById/:tenant_id').get(getTenantById);

module.exports = router;