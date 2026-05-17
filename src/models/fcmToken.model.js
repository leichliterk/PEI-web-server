const mongoose = require('mongoose');

// One token per user — upsert by auth0_id on every app launch.
// If the user logs in on a new device the token is replaced.
const fcmTokenSchema = new mongoose.Schema({
    auth0_id: { type: String, required: true, unique: true },
    token:    { type: String, required: true },
    platform: { type: String, default: 'android' },
    updated_at: { type: Date, default: Date.now }
}, { collection: 'fcmtokens', timestamps: false });

module.exports = mongoose.model('FcmToken', fcmTokenSchema);