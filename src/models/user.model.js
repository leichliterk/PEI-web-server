const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fname: {
        type: String,
        required: true
    },
    lname: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    auth0_id: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: false
    },
    status: {
        type: String,
        required: false
    },
    group: {
        type: String,
        required: false
    },
    company: {
        type: String,
        required: false
    },
    comment: {
        type: String,
        required: false
    },
}, { timestamps: true } );

userSchema.set('timestamps', true);

const User = mongoose.model('User', userSchema);

module.exports = User;