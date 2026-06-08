/**
 * Migration: Convert site_id fields from Number to String
 *
 * Affected collections:
 *   - plcsnapshots       (site_id)
 *   - sitereadings       (site_id)
 *   - siteaccounting     (site_id)
 *   - sitefiles          (site_id)
 *   - notifications      (site_id)
 *   - notificationrules  (site_id)
 *   - otareleaseres…     (site_id)
 *   - connectionsessions (site_id)
 *   - users              (site_ids array)
 *
 * Usage:
 *   node scripts/migrate-site-id-to-string.js
 *
 * Set MONGODB_URI in your environment or .env before running.
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
}

// Note: sitereadings and siteaccounting are time-series collections —
// MongoDB does not support in-place updates on them. The readings.controller
// handles both numeric and string site_id at query time instead.
const SINGLE_FIELD_COLLECTIONS = [
    'plcsnapshots',
    'sitefiles',
    'notifications',
    'notificationrules',
    'otareleaseres',
    'connectionsessions',
];

async function migrateSingleField(db, collectionName) {
    const result = await db.collection(collectionName).updateMany(
        { site_id: { $type: 'number' } },
        [{ $set: { site_id: { $toString: '$site_id' } } }]
    );
    console.log(`  ${collectionName}: ${result.modifiedCount} document(s) updated`);
    return result.modifiedCount;
}

async function migrateUsersArray(db) {
    // Convert each numeric element in site_ids to a string
    const result = await db.collection('users').updateMany(
        { site_ids: { $elemMatch: { $type: 'number' } } },
        [{ $set: { site_ids: { $map: { input: '$site_ids', as: 'id', in: { $toString: '$$id' } } } } }]
    );
    console.log(`  users (site_ids): ${result.modifiedCount} document(s) updated`);
    return result.modifiedCount;
}

async function run() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB\n');

        const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'staging';
        const db = client.db(dbName);

        console.log(`Database: ${dbName}`);
        console.log('Starting migration...\n');

        let total = 0;

        for (const name of SINGLE_FIELD_COLLECTIONS) {
            total += await migrateSingleField(db, name);
        }

        total += await migrateUsersArray(db);

        console.log(`\nMigration complete. Total documents updated: ${total}`);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

run();
