const asyncHandler = require("express-async-handler");

const about = asyncHandler(async (req, res, next) => {
    const about = {
        environment:  process.env.ENV_VAR,
        version: process.env.version
    }
    return res.json(about);
});

module.exports = {
    about
}