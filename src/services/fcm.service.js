const admin = require('firebase-admin');

let initialized = false;

function init() {
    if (initialized) return;

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
        console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT env var not set — push notifications disabled');
        return;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount))
        });
        initialized = true;
        console.log('[FCM] Firebase Admin SDK initialized');
    } catch (err) {
        console.error('[FCM] Failed to initialize Firebase Admin SDK:', err.message);
    }
}

/**
 * Send a push notification to a single device token.
 * @param {string} token - FCM device token
 * @param {string} title
 * @param {string} body
 * @param {Object} data - string key/value pairs for the data payload
 * @returns {Promise<void>}
 */
async function sendPush(token, title, body, data = {}) {
    if (!initialized) return;

    const message = {
        token,
        notification: { title, body },
        data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
        android: { priority: 'high' }
    };

    try {
        await admin.messaging().send(message);
    } catch (err) {
        // Token expired/invalid — caller can handle if needed
        console.error(`[FCM] Failed to send push to token ${token.slice(0, 20)}...:`, err.message);
        throw err;
    }
}

module.exports = { init, sendPush };
