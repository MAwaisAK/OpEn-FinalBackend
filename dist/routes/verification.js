"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _index = require('../controllers/verification/index'); var _index2 = _interopRequireDefault(_index); // Adjust path as needed

const router = _express2.default.Router();

router.get('/verify/:token', _index2.default.verifyEmail);
router.post('/forgot-password', _index2.default.forgotPassword);
router.post('/contactus', _index2.default.sendContactEmail);
router.post('/reset-password/:token', _index2.default.resetPassword);

exports. default = router;