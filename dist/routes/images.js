"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);
var _jwt = require('../helpers/jwt');
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);
var _images = require('../controllers/images'); var _images2 = _interopRequireDefault(_images);

const router = _express2.default.Router();
const storage = _multer2.default.memoryStorage();
const upload = _multer2.default.call(void 0, { storage });

// Update landing image. Expects a file in the field "landingimg".
router.put(
  "/update-landing",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "image"),
  upload.fields([{ name: "landingimg", maxCount: 1 }]),
  _images2.default.updateLandingImage
);

// Update landing mini image. Expects a file in the field "landingminiimg".
router.put(
  "/update-landingmini",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "image"),
  upload.fields([{ name: "landingminiimg", maxCount: 1 }]),
  _images2.default.updateLandingMiniImage
);

router.put(
  "/update-dashboard",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "image"),
  upload.fields([{ name: "dashboardimg", maxCount: 1 }]),
  _images2.default.updateDashboardImage
);


// Get landing image.
router.get("/get-landing", _images2.default.getLandingImage);

router.get("/get-stat-number", _images2.default.getDashboardStats);

// Get landing mini image.
router.get("/get-landingmini", _images2.default.getLandingMiniImage);

// (Optional) Get dashboard image.
router.get("/get-dashboard", _images2.default.getDashboardImage);

exports. default = router;
