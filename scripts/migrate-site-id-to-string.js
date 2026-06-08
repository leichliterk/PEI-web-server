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

// Collections where site_id is a single Number field
const SINGLE_FIELD_COLLECTIONS = [
    'plcsnapshots',
    'sitereadings',
    'siteaccounting',
    'sitefiles',
    'notifications',
    'notificationrules',
    'otareleaseres',     // OtaReleaseResponse
    'connectionsessions',
];

async function migrateSingleField(db, collectionName) {
    const col = db.collection(collectionName);

    // Find all docs where site_id is stored as a number
    const cursor = col.find({ site_id: { $type: 'number' } });
    let updated = 0;

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        await col.updateOne(
            { _id: doc._id },
            { $set: { site_id: String(doc.site_id) } }
        );
        updated++;
    }

    console.log(`  ${collectionName}: ${updated} document(s) updated`);
    return updated;
}

async function migrateUsersArray(db) {
    const col = db.collection('users');

    // Find all docs where site_ids contains at least one number
    const cursor = col.find({ site_ids: { $elemMatch: { $type: 'number' } } });
    let updated = 0;

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const converted = (doc.site_ids || []).map(id => String(id));
        await col.updateOne(
            { _id: doc._id },
            { $set: { site_ids: converted } }
        );
        updated++;
    }

    console.log(`  users (site_ids): ${updated} document(s) updated`);
    return updated;
}

async function run() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('Connected to MongoDB\n');

        // Derive DB name from the URI (last path segment), default to 'staging'
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
