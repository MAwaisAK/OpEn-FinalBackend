"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// messages.routes.js
var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _jwt = require('../helpers/jwt'); // This middleware sets req.payload
var _index = require('../controllers/message/index'); var _index2 = _interopRequireDefault(_index); // Adjust path as needed

const router = _express2.default.Router();

// Existing routes.
router.delete('/:messageId/delete-for-me', _jwt.verifyAccessToken, _index2.default.deleteForMe);
router.delete('/:messageId/delete-for-everyone', _jwt.verifyAccessToken, _index2.default.deleteForEveryone);

// New route: mark messages as seen.
// When a chat lobby loads, this endpoint loops through the messages (oldest first)
// and updates the unseen messages to seen until it finds a message that is already seen.
router.patch('/:chatLobbyId/mark-seen', _jwt.verifyAccessToken, _index2.default.markMessagesSeen);

exports. default = router;
