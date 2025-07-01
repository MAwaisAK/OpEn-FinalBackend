"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _jwt = require('../helpers/jwt');
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);
var _notifications = require('../controllers/notifications'); var _notifications2 = _interopRequireDefault(_notifications);

const router = _express2.default.Router();

// Send a notification to all users
router.post(
  "/send-to-all",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "createAny", "notification"),
  _notifications2.default.sendNotificationToAllUsers
);

// Get notifications for the current user
router.get(
  "/get-user-notifications",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "readOwn", "notification"),
  _notifications2.default.getUserNotifications
);

// Remove a selected notification item (requires { type, data } in the body)
router.post(
  "/remove-item",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateOwn", "notification"),
  _notifications2.default.removeNotificationItem
);

// Remove all notifications for the current user
router.post(
  "/remove-all",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "deleteOwn", "notification"),
  _notifications2.default.removeAllNotifications
);

exports. default = router;
