const asyncHandler = require('express-async-handler');
const JSZip = require('jszip');
const SiteFile = require('../models/siteFile.model');

// List files for a site
const getSiteFiles = asyncHandler(async (req, res) => {
    const { tenant_id, site_id } = req.params;

    const tenantIdNum = parseInt(tenant_id);

    const files = await SiteFile.find(
        { tenant_id: tenantIdNum, site_id },
        { content: 0 }  // Exclude binary content from listing
    ).sort({ createdAt: -1 });

    return res.status(200).json(files);
});

// Download a file by ID
const downloadFile = asyncHandler(async (req, res) => {
    const { file_id } = req.params;

    const file = await SiteFile.findById(file_id);

    if (!file) {
        return res.status(404).json({ message: 'File not found' });
    }

    res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Content-Length': file.content.length
    });

    return res.send(file.content);
});

/**
 * GET /api/data/files/download-zip
 * Query params:
 *   sites      - comma-separated site IDs  e.g. 1872,2002,1978
 *   categories - comma-separated categories e.g. flare_data,accounting_log
 *   date       - YYYY-MM-DD
 */
const downloadZip = asyncHandler(async (req, res) => {
    const { sites, categories, date } = req.query;
    const { tenant_id } = req.appUser;

    if (!sites || !categories || !date) {
        return res.status(400).json({ message: 'sites, categories, and date are required' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'date must be in YYYY-MM-DD format' });
    }

    const siteIds    = sites.split(',').map(s => s.trim());
    const cats       = categories.split(',').map(c => c.trim());
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay   = new Date(`${date}T23:59:59.999Z`);

    const files = await SiteFile.find({
        tenant_id,
        site_id:   { $in: siteIds },
        category:  { $in: cats },
        modifiedAt: { $gte: startOfDay, $lte: endOfDay }
    });

    if (files.length === 0) {
        return res.status(404).json({ message: 'No files found for the given criteria' });
    }

    // Index results for empty-query detection
    const found = new Set(files.map(f => `${f.site_id}::${f.category}`));
    const missingLines = [];
    for (const siteId of siteIds) {
        for (const cat of cats) {
            if (!found.has(`${siteId}::${cat}`)) {
                missingLines.push(`site_id=${siteId}  category=${cat}`);
            }
        }
    }

    const zip = new JSZip();
    for (const file of files) {
        zip.file(`${file.site_id}/${file.filename}`, file.content);
    }

    if (missingLines.length > 0) {
        const report = [
            `No files found for the following site/category combinations on ${date}:`,
            '',
            ...missingLines
        ].join('\n');
        zip.file('missing.txt', report);
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="files-${date}.zip"`,
        'Content-Length': buffer.length
    });

    return res.send(buffer);
});

module.exports = { getSiteFiles, downloadFile, downloadZip };
