const mongoose = require('mongoose');

const connectionLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['success', 'failure'], required: true },
  site_id: { type: Number, required: true },
  details: { type: String } // Optional: error message or metadata
});

module.exports = mongoose.model('ConnectionLog', connectionLogSchema);
