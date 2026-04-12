const crypto = require('crypto');
const path = require('path');
const { DateTime } = require('luxon');
const SiteFile = require('../../models/siteFile.model');
const SiteReading = require('../../models/siteReading.model');
const SiteAccounting = require('../../models/siteAccounting.model');
const Tenant = require('../../models/tenant.model');
const { getWebNamespace } = require('../namespaceRegistry');

/**
 * Decode a UTF-16 LE buffer (Windows default for tab-separated exports) to a string.
 * Strips the BOM if present.
 */
function decodeUtf16le(buffer) {
    let text = buffer.toString('utf16le');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return text;
}

/**
 * Sanitize a PLC tag name into a valid lowercase field name.
 * e.g. "GHS_1.TE_301.VLU.SCL" → "ghs_1_te_301_vlu_scl"
 */
function sanitizeColumnName(name) {
    return name.toLowerCase()
        .replace(/[.\s]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/, '');
}

/**
 * Parse a LineTrendGraph file buffer into an array of reading objects.
 * Files are UTF-16 LE, tab-separated. The header row defines the column names,
 * which vary per site (site-specific PLC tag names). All numeric columns are stored
 * using sanitized versions of their header names.
 */
function parseFlareData(buffer) {
    const lines = decodeUtf16le(buffer).split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Parse header: col 0 is "Date", remaining are measurement tag names
    const headers = lines[0].split('\t').map(h => sanitizeColumnName(h.trim()));

    const readings = [];
    const seenTimestamps = new Set();
    for (const line of lines.slice(1)) {
        const cols = line.split('\t');
        if (cols.length < 2) continue;

        const dateParts = cols[0].trim().split(/\s+/);
        if (dateParts.length < 2) continue;

        const [time, date] = dateParts;
        const [month, day, year] = date.split('-');
        const dt = DateTime.fromISO(`${year}-${month}-${day}T${time}`, { zone: 'America/New_York' });
        if (!dt.isValid) continue;

        // Skip DST spring-forward gap times (see parseAccountingLog for explanation)
        if (dt.toFormat('HH') !== time.slice(0, 2)) continue;

        const timestamp = dt.toJSDate();
        if (seenTimestamps.has(timestamp.getTime())) continue;
        seenTimestamps.add(timestamp.getTime());

        const reading = { timestamp, date_key: `${year}-${month}-${day}` };

        for (let i = 1; i < headers.length && i < cols.length; i++) {
            const val = parseFloat(cols[i]);
            if (!isNaN(val)) reading[headers[i]] = val;
        }

        readings.push(reading);
    }
    return readings;
}

/**
 * Parse an AccountingLog file buffer into an array of reading objects.
 * Files are UTF-16 LE, tab-separated. Columns are fixed:
 *   Date, FLR_FLOW, FLR_TEMP_50X, FLR_TEMP_502, INLET_PRESSURE, O2, CH4, FLR_SDV
 */
function parseAccountingLog(buffer) {
    const lines = decodeUtf16le(buffer).split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const readings = [];
    const seenTimestamps = new Set();
    for (const line of lines.slice(1)) {
        const cols = line.split('\t');
        if (cols.length < 8) continue;

        const dateParts = cols[0].trim().split(/\s+/);
        if (dateParts.length < 2) continue;

        const [time, date] = dateParts;
        const [month, day, year] = date.split('-');
        const dt = DateTime.fromISO(`${year}-${month}-${day}T${time}`, { zone: 'America/New_York' });
        if (!dt.isValid) continue;

        // Skip times that fall in a DST spring-forward gap. Luxon advances gap
        // times to the next valid hour, which produces the same UTC timestamp as
        // the real post-DST row — causing duplicate inserts with different values.
        if (dt.toFormat('HH') !== time.slice(0, 2)) continue;

        const timestamp = dt.toJSDate();

        // Deduplicate within this file in case the source contains repeat rows
        if (seenTimestamps.has(timestamp.getTime())) continue;
        seenTimestamps.add(timestamp.getTime());

        readings.push({
            timestamp,
            date_key:       `${year}-${month}-${day}`,
            flr_flow:       parseFloat(cols[1]),
            flr_temp_50x:   parseFloat(cols[2]),
            flr_temp_502:   parseFloat(cols[3]),
            inlet_pressure: parseFloat(cols[4]),
            o2:             parseFloat(cols[5]),
            ch4:            parseFloat(cols[6]),
            flr_sdv:        parseFloat(cols[7])
        });
    }
    return readings;
}

/**
 * Deduplicate against existing records in the time range, then bulk-insert new rows.
 * Returns the number of rows inserted.
 *
 * @param {mongoose.Model} Model - The target time-series model (SiteReading or SiteAccounting)
 */
async function storeReadings(Model, tenant_id, site_id, readings) {
    if (readings.length === 0) return 0;

    const minTs = new Date(Math.min(...readings.map(r => r.timestamp)));
    const maxTs = new Date(Math.max(...readings.map(r => r.timestamp)));

    const existing = await Model.find(
        { tenant_id, site_id, timestamp: { $gte: minTs, $lte: maxTs } }
    ).select('timestamp');

    const existingSet = new Set(existing.map(r => r.timestamp.getTime()));
    const newReadings = readings
        .filter(r => !existingSet.has(r.timestamp.getTime()))
        .map(r => ({ ...r, tenant_id, site_id }));

    if (newReadings.length === 0) return 0;
    await Model.insertMany(newReadings, { ordered: false });
    return newReadings.length;
}

/**
 * Emit the most recent reading from a parsed batch to all web clients subscribed to the tenant.
 * Readings are in chronological file order, so the last entry is the most recent.
 *
 * @param {number} tenant_id
 * @param {number} site_id
 * @param {'flare_data'|'accounting_log'} type
 * @param {Array} readings
 */
/**
 * Emit a site_data event to all web clients subscribed to the tenant.
 * Sends a focused subset of accounting log fields representing current site status.
 */
function broadcastSiteData(tenant_id, site_id, readings) {
    const webNs = getWebNamespace();
    if (!webNs || readings.length === 0) return;

    const latest = readings[readings.length - 1];
    webNs.to(`tenant:${tenant_id}`).emit('site_data', {
        site_id,
        tenant_id,
        timestamp:      latest.timestamp,
        flr_flow:       latest.flr_flow,
        ch4:            latest.ch4,
        inlet_pressure: latest.inlet_pressure,
        o2:             latest.o2,
        flr_sdv:        latest.flr_sdv
    });
}

function broadcastLatestReading(tenant_id, site_id, type, readings) {
    const webNs = getWebNamespace();
    if (!webNs || readings.length === 0) return;

    const latest = readings[readings.length - 1];
    webNs.to(`tenant:${tenant_id}`).emit('site:reading', { tenant_id, site_id, type, reading: latest });
}

function resolveCategory(filename) {
    if (filename.includes('AccountingLog')) return 'accounting_log';
    if (filename.includes('LineTrendGraph')) return 'flare_data';
    if (path.extname(filename).toUpperCase() === '.DAE') return 'cr_files';
    return 'uncategorized';
}

const fileHandler = {
    /**
     * Handle file upload from desktop app
     * @param {Object} socket - Socket.io socket instance
     * @param {Object} data - File payload from desktop
     */
    async onFileUpload(socket, data) {
        const { tenant_id, site_id } = socket.siteData;
        const { filename, content, encoding, size, modifiedAt, sha256 } = data;
        const source = data.source || 'unknown';
        console.log(`[FileHandler] ftp:file received from ${tenant_id}-${site_id}: filename=${filename}, encoding=${encoding}, size=${size}, hasContent=${!!content}, hasHash=${!!sha256}, hasSource=${!!data.source}`);

        if (!filename || !content || !encoding || !sha256) {
            socket.emit('ftp:file_ack', { success: false, filename, error: 'Missing required fields: filename, content, encoding, sha256' });
            return;
        }

        if (encoding !== 'base64') {
            socket.emit('ftp:file_ack', { success: false, filename, error: `Unsupported encoding: ${encoding}` });
            return;
        }

        try {
            const fileBuffer = Buffer.from(content, 'base64');

            // Verify integrity
            const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            if (computedHash !== sha256) {
                console.error(`Hash mismatch for ${filename} from ${tenant_id}-${site_id}`);
                socket.emit('ftp:file_ack', { success: false, filename, error: 'File integrity check failed: SHA-256 mismatch' });
                return;
            }

            const siteFile = await SiteFile.findOneAndUpdate(
                { tenant_id, site_id, filename },
                {
                    content: fileBuffer,
                    size: size ?? fileBuffer.length,
                    modifiedAt: modifiedAt ? new Date(modifiedAt) : new Date(),
                    source,
                    sha256,
                    category: resolveCategory(filename)
                },
                { upsert: true, new: true }
            );

            console.log(`File received from ${tenant_id}-${site_id}: ${filename} (${fileBuffer.length} bytes)`);

            // Refresh last_seen in MongoDB so HTTP consumers don't see a stale value
            // (file uploads are the only activity signal after connect, now that heartbeats are gone)
            await Tenant.findOneAndUpdate(
                { tenant_id, 'sites.site_id': site_id },
                { $set: { 'sites.$.last_seen': new Date() } }
            );

            // Parse and store time-series readings (fire-and-forget)
            if (siteFile.category === 'flare_data') {
                const readings = parseFlareData(fileBuffer);
                storeReadings(SiteReading, tenant_id, site_id, readings)
                    .then(count => {
                        if (count > 0) {
                            console.log(`Stored ${count} new reading(s) from ${filename} for ${tenant_id}-${site_id}`);
                            broadcastLatestReading(tenant_id, site_id, 'flare_data', readings);
                        }
                    })
                    .catch(err => console.error(`Failed to store readings from ${filename}:`, err));
            } else if (siteFile.category === 'accounting_log') {
                const readings = parseAccountingLog(fileBuffer);
                storeReadings(SiteAccounting, tenant_id, site_id, readings)
                    .then(count => {
                        if (count > 0) {
                            console.log(`Stored ${count} new accounting record(s) from ${filename} for ${tenant_id}-${site_id}`);
                            broadcastLatestReading(tenant_id, site_id, 'accounting_log', readings);
                            broadcastSiteData(tenant_id, site_id, readings);
                        }
                    })
                    .catch(err => console.error(`Failed to store accounting records from ${filename}:`, err));
            }

            socket.emit('ftp:file_ack', { success: true, filename, file_id: siteFile._id });
        } catch (error) {
            console.error(`File upload error from ${tenant_id}-${site_id}:`, error);
            socket.emit('ftp:file_ack', { success: false, filename, error: 'Failed to store file' });
        }
    }
};

module.exports = fileHandler;
