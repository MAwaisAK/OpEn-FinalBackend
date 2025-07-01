"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _news = require('../controllers/news');

const router = _express2.default.Router();

router.get('/', _news.getAllNews);
router.put('/:newsId/replace', _news.replaceNewsSection);

exports. default = router;
