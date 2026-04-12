const { auth } = require('express-oauth2-jwt-bearer');
const User = require('../models/user.model');

/**
 * requireAuth — validates any Auth0 JWT.
 * Populates req.auth (payload.sub = auth0_id).
 */
const requireAuth = auth({
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    audience:      process.env.AUTH0_API_AUDIENCE,
});

/**
 * requireAdmin — must be used after requireAuth.
 * Verifies the authenticated user exists in the DB and holds the 'admin' role.
 * Attaches req.appUser for use in controllers.
 */
async function requireAdmin(req, res, next) {
    const auth0_id = req.auth?.payload?.sub;
    if (!auth0_id) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const user = await User.findOne({ auth0_id }).lean();
        if (!user)              return res.status(401).json({ error: 'User not found' });
        if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

        req.appUser = user;
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { requireAuth, requireAdmin };
