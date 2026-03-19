const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const about = asyncHandler(async (req, res, next) => {
    const about = {
        environment:  process.env.ENV_VAR,
        version: process.env.version,
        mongodbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    }
    return res.json(about);
});

module.exports = {
    about
}