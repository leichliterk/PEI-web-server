const asyncHandler = require('express-async-handler');
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

module.exports = { getSiteFiles, downloadFile };
