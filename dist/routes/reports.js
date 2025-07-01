"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
const router = _express2.default.Router();

var _reports = require('../controllers/reports'); var _reports2 = _interopRequireDefault(_reports);

router.post('/', _reports2.default.Create);
router.get('/', _reports2.default.List);
router.get('/my-report', _reports2.default.GetMyReport);

exports. default = router;