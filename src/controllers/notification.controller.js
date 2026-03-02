const asyncHandler = require('express-async-handler');
const Notification = require('../models/notification.model');

/**
 * GET /api/data/notifications/user/:auth0_id
 * List notifications for a user.
 * Query params: ?unread_only=true, ?limit=50
 */
const getUserNotifications = asyncHandler(async (req, res) => {
    const { auth0_id } = req.params;
    const { unread_only, limit = '50' } = req.query;

    const filter = { recipient_type: 'user', auth0_id };
    if (unread_only === 'true') filter.read_at = null;

    const notifications = await Notification.find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .select('-__v');

    return res.status(200).json({ notifications, count: notifications.length });
});

/**
 * GET /api/data/notifications/site/:tenant_id/:site_id
 * List notifications for a site.
 * Query params: ?unread_only=true, ?limit=50
 */
const getSiteNotifications = asyncHandler(async (req, res) => {
    const { tenant_id, site_id } = req.params;
    const { unread_only, limit = '50' } = req.query;

    const filter = {
        recipient_type: 'site',
        tenant_id: parseInt(tenant_id),
        site_id: parseInt(site_id)
    };
    if (unread_only === 'true') filter.read_at = null;

    const notifications = await Notification.find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .select('-__v');

    return res.status(200).json({ notifications, count: notifications.length });
});

/**
 * PATCH /api/data/notifications/:id/read
 * Mark a single notification as read.
 */
const markNotificationRead = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
        id,
        { read_at: new Date() },
        { new: true }
    );

    if (!notification) {
        return res.status(404).json({ message: 'Notification not found' });
    }

    return res.status(200).json({ message: 'Notification marked as read', notification });
});

/**
 * POST /api/data/notifications/user/:auth0_id/read-all
 * Mark all notifications for a user as read.
 */
const markAllUserNotificationsRead = asyncHandler(async (req, res) => {
    const { auth0_id } = req.params;

    const result = await Notification.updateMany(
        { recipient_type: 'user', auth0_id, read_at: null },
        { read_at: new Date() }
    );

    return res.status(200).json({ message: 'All notifications marked as read', count: result.modifiedCount });
});

/**
 * POST /api/data/notifications/site/:tenant_id/:site_id/read-all
 * Mark all notifications for a site as read.
 */
const markAllSiteNotificationsRead = asyncHandler(async (req, res) => {
    const { tenant_id, site_id } = req.params;

    const result = await Notification.updateMany(
        {
            recipient_type: 'site',
            tenant_id: parseInt(tenant_id),
            site_id: parseInt(site_id),
            read_at: null
        },
        { read_at: new Date() }
    );

    return res.status(200).json({ message: 'All notifications marked as read', count: result.modifiedCount });
});

module.exports = {
    getUserNotifications,
    getSiteNotifications,
    markNotificationRead,
    markAllUserNotificationsRead,
    markAllSiteNotificationsRead
};
