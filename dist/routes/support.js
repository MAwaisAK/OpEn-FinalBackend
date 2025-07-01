"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);









var _support = require('../controllers/support');
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);
var _jwt = require('../helpers/jwt');

const router = _express2.default.Router();

// Create a new report
router.post(
  "/",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "createAny", "report"),
  _support.createReport
);

// Bulk update: change status for multiple reports (expects req.body.reportIds and req.body.newStatus)
router.put(
  "/update-status",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "report"),
  _support.updateReportStatus
);

// Update a report by its ID
router.put(
  "/:reportId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "report"),
  _support.updateReport
);


router.get(
  "/last4", // e.g., GET /api/report/user
  _jwt.verifyAccessToken,
  _support.getLastFourReports
);

// Delete a report by its ID
router.delete(
  "/:reportId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "deleteAny", "report"),
  _support.deleteReport
);

// Get all reports
router.get("/", _jwt.verifyAccessToken, _support.getAllReports);
//router.get("/status/:userId", verifyAccessToken, getStatusForUser);

// Get a report by its ID
router.get(
  "/:reportId",
  _jwt.verifyAccessToken,
  _support.getReportById
);

router.get(
  "/user/:userId", // e.g., GET /api/report/user
  _jwt.verifyAccessToken,
  _support.getReportsForUser
);

exports. default = router;
