const Tenant = require('../../models/tenant.model');
const crypto = require('crypto');

/**
 * Socket.io authentication middleware
 * Validates API key, site_id, and tenant_id from handshake auth
 */
async function authMiddleware(socket, next) {
    const { api_key, site_id, tenant_id, connection_source, app_version } = socket.handshake.auth;

    if (!api_key || !site_id || !tenant_id) {
        return next(new Error('Missing authentication credentials'));
    }

    try {
        // Find tenant and validate site exists
        const tenant = await Tenant.findOne({ tenant_id: parseInt(tenant_id) });

        if (!tenant) {
            return next(new Error('Invalid tenant'));
        }

        const site = tenant.sites.find(s => s.site_id === site_id);

        if (!site) {
            return next(new Error('Invalid site'));
        }

        // Validate API key (compare hashed values)
        const hashedKey = crypto.createHash('sha256').update(api_key).digest('hex');

        if (site.api_key !== hashedKey) {
            return next(new Error('Invalid API key'));
        }

        // Attach site info to socket for later use
        socket.siteData = {
            tenant_id: parseInt(tenant_id),
            site_id,
            site_name: site.name,
            connection_source: connection_source || 'unknown'
        };

        // Update app_version on the site if provided
        if (app_version) {
            await Tenant.findOneAndUpdate(
                { tenant_id: parseInt(tenant_id), 'sites.site_id': site_id },
                { $set: { 'sites.$.app_version': app_version } }
            );
        }

        next();
    } catch (error) {
        console.error('WebSocket auth error:', error);
        next(new Error('Authentication failed'));
    }
}

module.exports = authMiddleware;
