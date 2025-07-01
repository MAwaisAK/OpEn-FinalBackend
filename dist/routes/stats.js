"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
const router = _express2.default.Router();

var _stats = require('../controllers/stats'); var _stats2 = _interopRequireDefault(_stats);

// Get total number of courses
router.get('/total-courses', _stats2.default.getTotalCourses);

// Get total number of tools
router.get('/total-tools', _stats2.default.getTotalTools);

// Get total number of users
router.get('/total-users', _stats2.default.getTotalUsers);

// Get total logins in the last 7 days
router.get('/total-signup-last7days', _stats2.default.getTotalSignupsLast7Days);

// Get total active tribes measured by status
router.get('/total-active-tribes', _stats2.default.getTotalActiveTribes);

// Get random 5 tribers (full name, last name, username, profile_pic)
router.get('/random-tribers', _stats2.default.getRandomTribers);

// Get top 8 tribes with most members
router.get('/top-tribes', _stats2.default.getTopTribesWithMostMembers);

// Get random 7 courses
router.get('/random-courses', _stats2.default.getRandomCourses);

// Get random 7 tools
router.get('/random-tools', _stats2.default.getRandomTools);

exports. default = router;
