/**
 * Backfill daily report data for the last 3 months.
 *
 * Usage:
 *   node scripts/backfill-daily-reports.js
 *
 * Set MONGODB_URI in your environment or .env before running.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { buildForDate } = require('../src/services/dailyReportBuilder');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
}

async function run() {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 90);

    // Build list of dates from 90 days ago through yesterday
    const dates = [];
    const cur = new Date(start);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    while (cur <= yesterday) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }

    console.log(`Backfilling ${dates.length} days (${dates[0]} → ${dates[dates.length - 1]})\n`);

    for (const dateKey of dates) {
        console.log(`Processing ${dateKey}...`);
        await buildForDate(dateKey);
    }

    console.log('\nBackfill complete.');
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
});
