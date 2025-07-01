"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _category = require('../controllers/category'); var _category2 = _interopRequireDefault(_category);

const router = _express2.default.Router();

// Create or update the single category document
router.post("/", _category2.default.createOrUpdateCategory);

// Delete a specific value from an array
router.delete("/", _category2.default.deleteCategoryItem);

// Get arrays separately
router.get("/support", _category2.default.getSupportArray);
router.get("/courses", _category2.default.getCoursesArray);
router.get("/tools", _category2.default.getToolsArray);

exports. default = router;
