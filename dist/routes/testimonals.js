"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);
var _jwt = require('../helpers/jwt');
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);
var _testimonal = require('../controllers/testimonal'); var _testimonal2 = _interopRequireDefault(_testimonal);

const router = _express2.default.Router();
const storage = _multer2.default.memoryStorage();
const upload = _multer2.default.call(void 0, { storage });

// Add a new testimonial (expects a file in the field "img").
router.post(
  "/add",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "createAny", "testimonal"),
  upload.fields([{ name: "img", maxCount: 1 }]),
  _testimonal2.default.addTestimonal
);

// Get all testimonials.
router.get("/get-all", _testimonal2.default.getAllTestimonals);

// Update a testimonial by ID (expects a file in the field "img" if updating image).
router.put(
  "/update/:id",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "testimonal"),
  upload.fields([{ name: "img", maxCount: 1 }]),
  _testimonal2.default.updateTestimonal
);

// Delete a testimonial by ID.
router.delete(
  "/delete/:id",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "deleteAny", "testimonal"),
  _testimonal2.default.deleteTestimonal
);

exports. default = router;
