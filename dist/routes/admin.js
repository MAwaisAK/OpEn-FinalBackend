"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);










var _admin = require('../controllers/admin');
var _jwt = require('../helpers/jwt');

const router = _express2.default.Router();

// Public routes
// Admin login
router.post('/login', _admin.loginAdmin);
router.post('/logout', _admin.logoutAdmin);
// Refresh admin tokens
router.post('/refresh_token', _admin.RefreshToken);


// Protected admin routes (requires valid access token)
// Create a new admin (only super-admins)
router.post(
  '/create',
  _jwt.verifyAccessToken,
  _admin.createAdmin
);
router.get("/me", _admin.getCurrentAdmin);

// Get list of all admins
router.get(
  '/',
  _jwt.verifyAccessToken,
  _admin.getAllAdmins
);

// Update an admin's role
router.put(
  '/role',
  _jwt.verifyAccessToken,
  _admin.updateAdminRole
);

// Update admin credentials (username/password)
router.put(
  '/update',
  _jwt.verifyAccessToken,
  _admin.updateAdminCredentials
);

// Delete an admin
router.delete(
  '/:adminId',
  _jwt.verifyAccessToken,
  _admin.deleteAdmin
);

exports. default = router;
