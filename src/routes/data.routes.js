const express = require('express');

const { about } = require('../controllers/utility.controller');
const { getAllUsers, getUser, userExists, registerUser, updateUser  } = require('../controllers/user.controller');
const { connStatus } = require('../controllers/site.controller');

const router = express.Router();



/****************************************
 * 
 *   Utility routes
 * 
 ****************************************/

router.route('/about').get(about);

router.route('/conn-status').put(connStatus);


/****************************************
 * 
 *   User routes
 * 
 ****************************************/

router.route('/user/users').get(getAllUsers);

router.route('/user/email/:email').get(getUser);

router.route('/user/check/:email/').get(userExists);

router.route('/user/registerUser').post(registerUser);

router.route('/user/updateUser').put(updateUser);




module.exports = router;