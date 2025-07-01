"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
const router = _express2.default.Router();
var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);

var _auth = require('../controllers/auth'); var _auth2 = _interopRequireDefault(_auth);
var _jwt = require('../helpers/jwt');

// Public routes
router.post('/register', _auth2.default.Register);
router.post('/login', _auth2.default.Login);
router.post('/refresh_token', _auth2.default.RefreshToken);
router.post('/logout', _auth2.default.Logout);

router.get('/total-login/:rangeType', _auth2.default.GetTotalNumberOfRegistrationsByDateRange);

// Set up Multer storage configuration
const upload = _multer2.default.call(void 0, { storage: _multer2.default.memoryStorage() });

// Use field names "profile_pic" and "banner_image" as expected by the client
router.put(
  "/update-user-info",
  _jwt.verifyAccessToken,
  upload.fields([
    { name: "profile_pic", maxCount: 1 },
    { name: "banner_image", maxCount: 1 }
  ]),
  _auth2.default.updateUserInfo
);


// Protected routes
router.put('/address', _jwt.verifyAccessToken, _auth2.default.updateAddress);
router.get('/get-address',_jwt.verifyAccessToken,_auth2.default.getAddress);
router.get('/me', _jwt.verifyAccessToken, _auth2.default.Me);
router.post('/chat-lobby', _jwt.verifyAccessToken, _auth2.default.getOrCreateChatLobby);
router.get('/get-chat-lobbies', _jwt.verifyAccessToken, _auth2.default.getUserChatLobbies);
router.post("/create-chat-lobby", _jwt.verifyAccessToken,_auth2.default.createChatLobby);
router.get('/get-users',_jwt.verifyAccessToken,_auth2.default.getAllUsers);
router.get('/chat-messages/:chatLobbyId', _jwt.verifyAccessToken, _auth2.default.getChatMessages);
router.post('/delete-chat-for-user', _jwt.verifyAccessToken, _auth2.default.deleteChatForUser);


router.get('/adminusers', _jwt.verifyAccessToken, _auth2.default.getAllAdminUsers);
router.put('/userupdate/:userId', _jwt.verifyAccessToken, _auth2.default.updateUserAdminDetails);

router.post("/send-request", _jwt.verifyAccessToken, _auth2.default.sendFriendRequest);

// Accept a friend request
router.put("/accept-request", _jwt.verifyAccessToken, _auth2.default.acceptFriendRequest);
router.get("/friend-requests", _jwt.verifyAccessToken, _auth2.default.getAllFriendRequests);
router.get("/friend-list", _jwt.verifyAccessToken, _auth2.default.getAllFriendList);
router.get("/friendlist", _jwt.verifyAccessToken, _auth2.default.getFriendList);
router.get("/chat-lobby", _jwt.verifyAccessToken, _auth2.default.getChatLobby);
// Reject a friend request
router.put("/reject-request", _jwt.verifyAccessToken, _auth2.default.rejectFriendRequest);

// Block a user
router.put("/block-user", _jwt.verifyAccessToken, _auth2.default.blockUser);

// Unblock a user
router.put("/unblock-user", _jwt.verifyAccessToken, _auth2.default.unblockUser);
router.put("/remove-friend", _jwt.verifyAccessToken, _auth2.default.removeFriend);
router.put("/cancel-sent-request", _jwt.verifyAccessToken,_auth2.default.cancelSentFriendRequest);
router.put("/remove-rejected-request", _jwt.verifyAccessToken, _auth2.default.removeRejectedFriendRequest);
router.put("/update-password", _jwt.verifyAccessToken, _auth2.default.updateUserPassword);
router.put("/update-user-media", _jwt.verifyAccessToken, _auth2.default.updateUserMedia);
router.put("/update-username", _jwt.verifyAccessToken, _auth2.default.updateUsername);
router.put("/remove-banner", _jwt.verifyAccessToken, _auth2.default.removeUserBanner);

// Route to remove profile picture
router.put("/remove-profile-pic", _jwt.verifyAccessToken, _auth2.default.removeUserProfilePic);
router.put("/tribes/join", _jwt.verifyAccessToken, _auth2.default.joinTribe);
router.put("/tribes/leave", _jwt.verifyAccessToken, _auth2.default.leaveTribe);

// Course endpoints
router.put("/courses/add", _jwt.verifyAccessToken, _auth2.default.addCourse);
router.put("/courses/remove", _jwt.verifyAccessToken, _auth2.default.removeCourse);

// Tool endpoints
router.put("/tools/add", _jwt.verifyAccessToken, _auth2.default.addTool);
router.put("/tools/remove", _jwt.verifyAccessToken, _auth2.default.removeTool);

// Delete user account
router.delete("/account", _jwt.verifyAccessToken, _auth2.default.deleteAccount);
router.put("/accept-request", _jwt.verifyAccessToken, _auth2.default.acceptTribeRequest);

// Route for tribe admins to reject a join request.
router.put("/reject-request", _jwt.verifyAccessToken, _auth2.default.rejectTribeRequest);
router.get("/profile/:targetUserId", _jwt.verifyAccessToken, _auth2.default.getUserProfileForChecker);
router.get("/tribes-profile", _jwt.verifyAccessToken, _auth2.default.getUserProfileForUser);
router.get("/search-tribers", _jwt.verifyAccessToken, _auth2.default.searchTribers);
router.get('/user-search', _jwt.verifyAccessToken, _auth2.default.searchUsers);

// Route to get all courses for the current user
router.get("/courses", _jwt.verifyAccessToken, _auth2.default.getAllCoursesForUser);

// Route to get all tribers for the current user
router.get("/tribers", _jwt.verifyAccessToken, _auth2.default.getAllTribersForUser);

// Route to get all tribes for the current user
router.get("/tribes", _jwt.verifyAccessToken, _auth2.default.getAllTribesForUser);
router.delete('/user/:id', _jwt.verifyAccessToken, _auth2.default.deleteUser);

// Route to get all blocked users for the current user
router.get("/blocked", _jwt.verifyAccessToken, _auth2.default.getAllBlockedForUser);
router.get("/details/:tribeId", _jwt.verifyAccessToken, _auth2.default.getTribeDetails);
router.delete('/chat-lobbies/:chatLobbyId', _jwt.verifyAccessToken, _auth2.default.deleteChatLobbyForUser);

// New routes for blocking/unblocking a user from a tribe (admin-only)
router.put("/block-user", _jwt.verifyAccessToken, _auth2.default.blockUserFromTribe);
router.put("/unblock-user", _jwt.verifyAccessToken, _auth2.default.unblockUserFromTribe);
router.put("/kick-user", _jwt.verifyAccessToken, _auth2.default.kickUserFromTribe);

// Route to get all members of a tribe
router.get("/members/:tribeId", _jwt.verifyAccessToken, _auth2.default.getTribeMembers);
router.get(
  '/users/info',
  _jwt.verifyAccessToken,
  _auth2.default.getUsersChatInfo
);

exports. default = router;