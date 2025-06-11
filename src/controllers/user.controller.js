const asyncHandler = require("express-async-handler");
const superagent = require('superagent');

const UserSchema = require('../models/user.model');

const getUser = asyncHandler(async (req, res, next) => {
    const userEmail = req.params.email || req.user.email;
    const user = await UserSchema.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
});

const userExists = asyncHandler(async (req, res, next) => {
    const user = await UserSchema.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ status: 2, message: 'User not found' });
    else return res.json({ message: 'User exists' });
});

const getAllUsers = asyncHandler(async (req, res, next) => {
    const users = await UserSchema.find();
    if(!users) return res.status(404).json({ message: 'No users found.' });
    return res.json({ data: users, records: users.length,  status: "success", code: "001" });
});

const updateUser = asyncHandler(async  (req, res, next) => {
    const user = await UserSchema.findOne({ email : req.body.email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    Object.assign(user, req.body);
    try {
        await user.save();
        return res.json(user);
    } catch (error) {
        return res.status(500).json({ message: 'Error updating user', error });
    }
})

module.exports = {
    getUser,
    getAllUsers,
    updateUser,
    userExists
}