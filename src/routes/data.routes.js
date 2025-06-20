const express = require('express');

const { about } = require('../controllers/utility.controller');
const { getAllUsers, updateUser, userExists, getUser } = require('../controllers/user.controller');

const router = express.Router();



/****************************************
 * 
 *   Utility routes
 * 
 ****************************************/

router.route('/about').get(about);


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