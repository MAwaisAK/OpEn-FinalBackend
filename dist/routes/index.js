"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express');
// helpers
var _jwt = require('../helpers/jwt');

// routes
var _auth = require('./auth'); var _auth2 = _interopRequireDefault(_auth);
var _uploads = require('./uploads'); var _uploads2 = _interopRequireDefault(_uploads);
var _message = require('./message'); var _message2 = _interopRequireDefault(_message); // our new routes file for deletion
var _course = require('./course'); var _course2 = _interopRequireDefault(_course); // our new routes file for deletion
var _tools = require('./tools'); var _tools2 = _interopRequireDefault(_tools); // our new routes file for deletion
var _liftai = require('./lift-ai'); var _liftai2 = _interopRequireDefault(_liftai); // our new routes file for deletion
var _mytribes = require('./mytribes'); var _mytribes2 = _interopRequireDefault(_mytribes); // our new routes file for deletion
var _price = require('./price'); var _price2 = _interopRequireDefault(_price); // our new routes file for deletion
var _stats = require('./stats'); var _stats2 = _interopRequireDefault(_stats); // our new routes file for deletion
//import product from './product';
//import order from './order';
var _categories = require('./categories'); var _categories2 = _interopRequireDefault(_categories);
//import reports from './reports';
var _verification = require('./verification'); var _verification2 = _interopRequireDefault(_verification);
var _news = require('./news'); var _news2 = _interopRequireDefault(_news);
var _images = require('./images'); var _images2 = _interopRequireDefault(_images);
var _testimonals = require('./testimonals'); var _testimonals2 = _interopRequireDefault(_testimonals);
var _support = require('./support'); var _support2 = _interopRequireDefault(_support);
var _notifications = require('./notifications'); var _notifications2 = _interopRequireDefault(_notifications);
var _admin = require('./admin'); var _admin2 = _interopRequireDefault(_admin);
var _payment = require('./payment'); var _payment2 = _interopRequireDefault(_payment);
const router = _express.Router.call(void 0, );

router.get('/', (req, res) => {
  res.end('hey');
});
router.use('/auth', _auth2.default);
router.use('/verify',_verification2.default);
router.use('/',_uploads2.default);
router.use('/messages', _message2.default);
router.use('/course', _course2.default);
router.use('/tool', _tools2.default);
router.use("/my-tribes", _mytribes2.default);
router.use("/lift-ai", _liftai2.default);
router.use("/price", _price2.default); 
router.use("/testimonals", _testimonals2.default); 
router.use("/admin", _admin2.default); 
router.use("/news", _news2.default); 
router.use("/support", _support2.default);
router.use("/notifications", _notifications2.default);
router.use("/payment", _payment2.default);
router.use("/stats", _stats2.default);
router.use('/categories', _categories2.default);
router.use('/images', _images2.default );


exports. default = router;
