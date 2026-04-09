const express = require('express');
const multer = require('multer');

const { about } = require('../controllers/utility.controller');
const { getAllUsers, getUser, userExists, registerUser, updateUser  } = require('../controllers/user.controller');
const { updateSiteName, getConnectionUptime } = require('../controllers/site.controller');
const { getTenantById } = require('../controllers/tenant.controller');
const { getSiteFiles, downloadFile } = require('../controllers/file.controller');
const { getSiteReadings, getSiteAccountingData, getLatestSiteData } = require('../controllers/readings.controller');
const {
    getUserNotifications,
    getSiteNotifications,
    markNotificationRead,
    markAllUserNotificationsRead,
    markAllSiteNotificationsRead,
    deleteNotification
} = require('../controllers/notification.controller');
const {
    uploadRelease,
    listReleases,
    downloadRelease,
    getReleaseResponses,
    patchRelease
} = require('../controllers/ota.controller');

const router = express.Router();

// Multer instance for OTA .exe uploads — memory storage, 500 MB limit, .exe only
const otaUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.exe')) {
            return cb(new Error('Only .exe files are accepted'));
        }
        cb(null, true);
    }
});



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

// Mark a single notification as read
router.route('/notifications/:id/read').patch(markNotificationRead);

// Delete a single notification
router.route('/notifications/:id').delete(deleteNotification);



/****************************************
 *
 *   Readings routes
 *
 ****************************************/

// GET /readings/:tenant_id/:site_id?start=2026-03-01&end=2026-03-07
router.route('/readings/:tenant_id/:site_id').get(getSiteReadings);

// GET /accounting/:tenant_id/latest  — most recent entry per site for the tenant
router.route('/accounting/:tenant_id/latest').get(getLatestSiteData);

// GET /accounting/:tenant_id/:site_id?start=2026-03-01&end=2026-03-07
router.route('/accounting/:tenant_id/:site_id').get(getSiteAccountingData);



/****************************************
 *
 *   Tenant routes
 *
 ****************************************/

router.route('/tenant/getTenantById/:tenant_id').get(getTenantById);



/****************************************
 *
 *   OTA update routes
 *
 ****************************************/

// Admin: upload a new .exe release and notify all sites in the tenant
router.route('/ota/upload').post(otaUpload.single('exe'), uploadRelease);

// Admin: list all releases for a tenant (with per-site response summary)
router.route('/ota/releases/:tenant_id').get(listReleases);

// Admin: per-site response details for a specific release
router.route('/ota/responses/:release_id').get(getReleaseResponses);

// Admin: manually archive a release
router.route('/ota/releases/:id').patch(patchRelease);

// Desktop: download the .exe  (requires Authorization: Bearer <download_token>)
router.route('/ota/download/:release_id').get(downloadRelease);

module.exports = router;