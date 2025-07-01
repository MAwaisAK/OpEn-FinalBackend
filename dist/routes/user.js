"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _users = require('../controllers/users');

const router = _express2.default.Router();

// Update user fields (tokens, subscription, role, status, level)
router.put("/", _users.getAllUsers);
router.put("/:userId", _users.updateUserDetails);

exports. default = router;
