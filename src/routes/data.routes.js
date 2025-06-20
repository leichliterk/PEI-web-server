const express = require('express');

const { getAllUsers, updateUser, userExists, getUser } = require('../controllers/user.controller');

const router = express.Router();


/****************************************
 * 
 *   User routes
 * 
 ****************************************/

router.route('/user/users').get(getAllUsers);

router.route('/user/email/:email').get(getUser);

router.route('/user/check/:email/').get(userExists);

router.route('/user/updateUser').put(updateUser);




module.exports = router;