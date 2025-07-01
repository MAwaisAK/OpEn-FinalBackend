"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);
var _jwt = require('../helpers/jwt');
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);


























var _tribes = require('../controllers/tribes');

const router = _express2.default.Router();

const storage = _multer2.default.memoryStorage();
const upload = _multer2.default.call(void 0, { storage });

// Accept thumbnail + multiple files
const toolUpload = upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "banner", maxCount: 1 },
]);
// Route to block a user from a specific tribe.
router.post(
  "/:tribeId/block/:userId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "mytribe"),
  _tribes.blockUserFromTribe
);

// Get tribe for a specific user.
router.get("/user/:userId", _tribes.getTribeForUser);

// Get a specific tribe by tribe ID.
router.get("/get-tribe/:tribeId", _tribes.getTribeById);


// Create a new Mytribe.
router.post(
  "/",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "createAny", "mytribe"),
  toolUpload,
  _tribes.createMytribe
);

// Update a Mytribe by ID.
router.put(
  "/:mytribeId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "mytribe"),
  toolUpload,
  _tribes.updateMytribe
);

// Delete a Mytribe by ID.
router.delete(
  "/:mytribeId",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "deleteAny", "mytribe"),
  _tribes.deleteMytribe
);

// Get all Mytribes.
router.get("/get-admin", _tribes.getAllMytribes);
router.get("/get-users", _tribes.getUsersMytribes);
router.get("/get-user-id/:userId", _tribes.getSpecificMytribes);
router.post("/get-tribes-by-ids", _tribes.getUserTribesByIds);
// Route to join a tribe.
router.post("/join-tribe", _jwt.verifyAccessToken, _tribes.joinTribe);

// Route to leave a tribe.
router.post("/leave-tribe", _jwt.verifyAccessToken, _tribes.leaveTribe);
router.get("/search", _tribes.searchUsersTribes);
// Route to get members of a specific tribe.
router.get("/tribe-members/:tribeId", _jwt.verifyAccessToken, _tribes.getTribeMembers);

// Route to remove a member from a tribe.
router.post("/remove-member", _jwt.verifyAccessToken, _tribes.removeMemberFromTribe);

// Get a Mytribe by its ID.
router.get("/user", _jwt.verifyAccessToken, _tribes.getTribes);
router.get("/:mytribeId", _tribes.getMytribeById);
router.get("/user-data", _jwt.verifyAccessToken, _tribes.getUserDetails);

router.post("/:tribeId/admins",   _tribes.addAdminToTribe);
router.delete("/:tribeId/admins/:userId", _tribes.removeAdminFromTribe);
router.get("/:tribeId/tribers",    _tribes.getTribeMembersSearch);


router.put(
  "/update-status",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "tool"),
  _tribes.updateTribeStatus
);

// Get total members for a specific Mytribe.
router.get(
  "/:mytribeId/total-members",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "readAny", "mytribe"),
  _tribes.getTotalMembers
);

router.post("/:tribeId/rate", _tribes.rateTribe);

router.get("/tribe-lobby/:tribeId", _tribes.createOrGetTribeChatLobby);

// Get tribe messages
router.get("/tribe-messages/:chatLobbyId", _tribes.getTribeChatMessages);


exports. default = router;
