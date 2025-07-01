"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _userjs = require('../../models/user.js'); var _userjs2 = _interopRequireDefault(_userjs);
var _paymentjs = require('../../models/payment.js'); var _paymentjs2 = _interopRequireDefault(_paymentjs); // if needed
var _toolsjs = require('../../models/tools.js'); var _toolsjs2 = _interopRequireDefault(_toolsjs);
var _coursesjs = require('../../models/courses.js'); var _coursesjs2 = _interopRequireDefault(_coursesjs);
var _mytribesjs = require('../../models/mytribes.js'); var _mytribesjs2 = _interopRequireDefault(_mytribesjs);
var _boom = require('boom'); var _boom2 = _interopRequireDefault(_boom);

// Get total number of courses
const getTotalCourses = async (req, res, next) => {
  try {
    const totalCourses = await _coursesjs2.default.countDocuments();
    return res.status(200).json({ success: true, totalCourses });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching total courses", error));
  }
};

// Get total number of tools
const getTotalTools = async (req, res, next) => {
  try {
    const totalTools = await _toolsjs2.default.countDocuments();
    return res.status(200).json({ success: true, totalTools });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching total tools", error));
  }
};

// Get total number of users
const getTotalUsers = async (req, res, next) => {
  try {
    const totalUsers = await _userjs2.default.countDocuments();
    return res.status(200).json({ success: true, totalUsers });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching total users", error));
  }
};

// Get total logins in the last 7 days
// Assumes that your User model has a "lastLogin" Date field updated on login.
const getTotalSignupsLast7Days = async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const totalSignups = await _userjs2.default.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    return res.status(200).json({ success: true, totalSignupsLast7Days: totalSignups });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching signup data", error));
  }
};

// Get total active tribes measured by status (assumes status field is "active" for active tribes)
const getTotalActiveTribes = async (req, res, next) => {
  try {
    const totalActiveTribes = await _mytribesjs2.default.countDocuments({ status: true });
    return res.status(200).json({ success: true, totalActiveTribes });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching active tribes", error));
  }
};

// Get random 5 tribers (assumes User model has fullName, lastName, username, profile_pic)
const getRandomTribers = async (req, res, next) => {
  try {
    const randomTribers = await _userjs2.default.aggregate([
      { $sample: { size: 5 } },
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          username: 1,
          aboutme:1,
          profile_pic: 1,
        },
      },
    ]);
    return res.status(200).json({ success: true, randomTribers });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching random tribers", error));
  }
};

// Get top 8 tribes with most members
// Assumes that the Tribes model has a "members" array field.
const getTopTribesWithMostMembers = async (req, res, next) => {
  try {
    const topTribes = await _mytribesjs2.default.aggregate([
      {
        $project: {
          _id:1,
          title: 1,
          members: 1,
          thumbnail:1,
          tribeCategory:1,
          memberCount: { $size: { $ifNull: ["$members", []] } },
        },
      },
      { $sort: { memberCount: -1 } },
      { $limit: 8 },
    ]);
    return res.status(200).json({ success: true, topTribes });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching top tribes", error));
  }
};

// Get random 7 courses
const getRandomCourses = async (req, res, next) => {
  try {
    const randomCourses = await _coursesjs2.default.aggregate([
      { $sample: { size: 7 } },
      {
        $project: {
          _id: 1,
          title: 1,
          courseCategory: 1,
          thumbnail: 1
        }
      }
    ]);
    return res.status(200).json({ success: true, randomCourses });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching random courses", error));
  }
};
const getRandomTools = async (req, res, next) => {
  try {
    const randomTools = await _toolsjs2.default.aggregate([
      { $sample: { size: 7 } },
      {
        $project: {
          _id: 1,
          title: 1,
          toolCategory: 1,
          thumbnail: 1
        }
      }
    ]);
    return res.status(200).json({ success: true, randomTools });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching random tools", error));
  }
};


exports. default = {
  getTotalCourses,
  getTotalTools,
  getTotalUsers,
  getTotalSignupsLast7Days,
  getTotalActiveTribes,
  getRandomTribers,
  getTopTribesWithMostMembers,
  getRandomCourses,
  getRandomTools,
};
