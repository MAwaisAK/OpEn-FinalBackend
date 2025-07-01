"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);











var _courses = require('../controllers/courses');
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);
var _jwt = require('../helpers/jwt');

const router = _express2.default.Router();

// Set up Multer for handling multiple files
const storage = _multer2.default.memoryStorage();
const upload = _multer2.default.call(void 0, { storage });

// Accept thumbnail + multiple files
const courseUpload = upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "files", maxCount: 5 },
]);

// Create a course with file and thumbnail support
router.post(
  "/",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "createAny", "course"),
  courseUpload,
  _courses.createCourse
);

// Bulk update: change price for multiple courses
router.put(
  "/update-price",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "course"),
  _courses.updateCoursesPrice
);

// Bulk update: change status for multiple courses (expects req.body.courseIds and req.body.newStatus boolean)
router.put(
  "/update-status",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "course"),
  _courses.updateCourseStatus
);

// Update a single course with new files
router.put(
  "/edit/:courseId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "course"),
  courseUpload,
  _courses.updateCourse
);

router.delete(
  "/:courseId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "deleteAny", "course"),
  _courses.deleteCourse
);
router.get("/user-course", _courses.getAllUserCourses);
router.get("/:courseId", _courses.getCourseById);
router.get("/", _courses.getAllCourses);
router.get("/category/:category", _courses.getCoursesByCategory);
router.post("/user-courses", _courses.getCoursesByIds);


exports. default = router;
