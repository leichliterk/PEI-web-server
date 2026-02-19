const mongoose = require('mongoose');

const siteFileSchema = new mongoose.Schema({
    tenant_id: {
        type: Number,
        required: true,
        index: true
    },
    site_id: {
        type: Number,
        required: true,
        index: true
    },
    filename: {
        type: String,
        required: true
    },
    content: {
        type: Buffer,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        required: true
    },
    source: {
        type: String,
        required: true
    },
    sha256: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['accounting_log', 'flare_data', 'cr_files', 'uncategorized'],
        required: true,
        default: 'uncategorized'
    }
}, { timestamps: true });

siteFileSchema.index({ tenant_id: 1, site_id: 1, createdAt: -1 });

const SiteFile = mongoose.model('SiteFile', siteFileSchema);

module.exports = SiteFile;
