"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);









var _tools = require('../controllers/tools');
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);
var _jwt = require('../helpers/jwt');

const router = _express2.default.Router();

// Set up Multer for handling multiple files
const storage = _multer2.default.memoryStorage();
const upload = _multer2.default.call(void 0, { storage });

// Accept thumbnail + multiple files
const toolUpload = upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "files", maxCount: 5 },
]);

// Create a tool with file and thumbnail support
router.post(
  "/",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "createAny", "tool"),
  toolUpload,
  _tools.createTool
);

// Update a tool with new files
router.put(
  "/edit/:toolId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "tool"),
  toolUpload,
  _tools.updateTool
);

// Bulk update: change status for multiple tools (expects req.body.toolIds and req.body.newStatus boolean)
router.put(
  "/update-status",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "tool"),
  _tools.updateToolStatus
);

router.delete(
  "/:toolId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "deleteAny", "tool"),
  _tools.deleteTool
);
router.get("/admin-tools",_jwt.verifyAccessToken, _tools.getAllTools);
router.get("/user-tools", _tools.getAllToolsUsers);
router.get("/:toolId", _tools.getToolById);
router.get("/category/:category", _tools.getToolsByCategory);

exports. default = router;
