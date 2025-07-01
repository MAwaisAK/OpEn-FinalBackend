"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _jwtjs = require('../helpers/jwt.js');
var _liftai = require('../controllers/lift-ai'); var _liftai2 = _interopRequireDefault(_liftai);

const router = _express2.default.Router();

router.post("/chat", _jwtjs.verifyAccessToken, _liftai2.default.chat);
router.get("/prompt", _jwtjs.verifyAccessToken, _liftai2.default.getPrompt);
router.get("/getAllPrompts", _jwtjs.verifyAccessToken, _liftai2.default.getAllPrompts);
router.put("/prompt", _jwtjs.verifyAccessToken, _liftai2.default.updatePrompt);
router.get("/tokens/:userId",_jwtjs.verifyAccessToken, _liftai2.default.getUserTokens);

exports. default = router;