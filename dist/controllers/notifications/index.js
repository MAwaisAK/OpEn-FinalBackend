"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _notifications = require('../../models/notifications'); var _notifications2 = _interopRequireDefault(_notifications);
var _user = require('../../models/user'); var _user2 = _interopRequireDefault(_user);
const Boom = require("boom");

/**
 * Send a notification to all users.
 */
 const sendNotificationToAllUsers = async (req, res, next) => {
  try {
    const { data } = req.body; // Expecting { data: "New Announcement" }

    if (!data) {
      return res.status(400).json({ success: false, message: "Notification data is required." });
    }

    // Get all users
    const users = await _user2.default.find({}, "_id");

    if (!users.length) {
      return res.status(404).json({ success: false, message: "No users found." });
    }

    // Process each user to create/update notifications
    const bulkOperations = users.map(user => ({
      updateOne: {
        filter: { user: user._id },
        update: {
          $setOnInsert: { user: user._id },
          $push: { 
            type: { $each: ["announcement"] },
            data: { $each: [data] }
          }
        },
        upsert: true
      }
    }));

    await _notifications2.default.bulkWrite(bulkOperations);

    return res.status(200).json({ success: true, message: "Notification sent to all users." });
  } catch (error) {
    console.error("Error sending notification:", error);
    return next(Boom.internal("Error sending notifications."));
  }
}; exports.sendNotificationToAllUsers = sendNotificationToAllUsers;



/**
 * Get notifications for the current user.
 */
 const getUserNotifications = async (req, res, next) => {
  try {
    // Use userId from query if provided; otherwise use authenticated user's ID.
    const userId = req.query.userId || _optionalChain([req, 'access', _ => _.user, 'optionalAccess', _2 => _2._id]) || _optionalChain([req, 'access', _3 => _3.user, 'optionalAccess', _4 => _4.id]);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    const notifications = await _notifications2.default.findOne({ user: userId });

    return res.status(200).json({
      success: true,
      data: notifications ? notifications : { type: [], data: "" }
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return next(Boom.internal("Error fetching notifications."));
  }
}; exports.getUserNotifications = getUserNotifications;



/**
 * Remove a selected notification item for the current user.
 * Expects req.body to have `{ type: "announcement", data: "Some Announcement" }`.
 */
 const removeNotificationItem = async (req, res, next) => {
  try {
    const userId = req.query.userId || _optionalChain([req, 'access', _5 => _5.user, 'optionalAccess', _6 => _6._id]) || _optionalChain([req, 'access', _7 => _7.user, 'optionalAccess', _8 => _8.id]);
    const { type, data } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }
    if (!type || !data) {
      return res.status(400).json({ success: false, message: "Type and data are required." });
    }

    // Load the notification document for the user
    const notificationDoc = await _notifications2.default.findOne({ user: userId });
    if (!notificationDoc) {
      return res.status(404).json({ success: false, message: "Notification document not found." });
    }

    // Find the index where both type and data match exactly
    const index = notificationDoc.type.findIndex((t, i) => t === type && notificationDoc.data[i] === data);
    if (index === -1) {
      return res.status(404).json({ success: false, message: "Notification item not found." });
    }

    // Remove the elements at that index in both arrays
    notificationDoc.type.splice(index, 1);
    notificationDoc.data.splice(index, 1);

    await notificationDoc.save();

    return res.status(200).json({ success: true, message: "Notification item removed." });
  } catch (error) {
    console.error("Error removing notification item:", error);
    return next(Boom.internal("Error removing notification item."));
  }
}; exports.removeNotificationItem = removeNotificationItem;


/**
 * Remove all notifications for the current user.
 */
 const removeAllNotifications = async (req, res, next) => {
  try {
    const userId = req.query.userId || _optionalChain([req, 'access', _9 => _9.user, 'optionalAccess', _10 => _10._id]) || _optionalChain([req, 'access', _11 => _11.user, 'optionalAccess', _12 => _12.id]);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }
    // Remove the entire notification document for the user
    await _notifications2.default.deleteOne({ user: userId });
    return res.status(200).json({ success: true, message: "All notifications removed." });
  } catch (error) {
    console.error("Error removing all notifications:", error);
    return next(Boom.internal("Error removing all notifications."));
  }
}; exports.removeAllNotifications = removeAllNotifications;

exports. default = {
  sendNotificationToAllUsers: exports.sendNotificationToAllUsers,
  getUserNotifications: exports.getUserNotifications,
  removeNotificationItem: exports.removeNotificationItem,
  removeAllNotifications: exports.removeAllNotifications
};
