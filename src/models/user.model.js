const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true
    },
    start_date: {
        type: Date,
        default: Date.now,
        required: true
    },
    end_date: {
        type: Date,
        default: () => Date.now() + (1000 * 60 * 60 * 24 * 365),
        required: true
    },
    comment: {
        type: String,
        required: false
    }
}, {timestamps: true} );

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
    phone: {
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
    myReports: [],
    subscription: [ subscriptionSchema ],
    comment: {
        type: String,
        required: false
    },
}, { timestamps: true } );

userSchema.set('timestamps', true);

const User = mongoose.model('User', userSchema);

module.exports = User;