"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _admin = require('../../models/admin'); var _admin2 = _interopRequireDefault(_admin);
const Boom = require('boom');




var _jwt = require('../../helpers/jwt');
const redis = require("../../clients/redis").default;

// Admin Login with access & refresh token logic
 const loginAdmin = async (req, res, next) => {
  const input = req.body;
  try {
    // 1. Find admin by username
    const admin = await _admin2.default.findOne({ username: input.username });
    if (!admin) {
      return next(Boom.notFound("Admin not found."));
    }

    // 2. Check password
    const isMatched = await admin.isValidPass(input.password);
    if (!isMatched) {
      return next(Boom.unauthorized("Invalid username or password."));
    }

    // 3. Token expiration based on "rememberMe"
    const tokenExpiry = "1h";

    // 4. Sign tokens
    const accessToken = await _jwt.signAccessToken.call(void 0, 
      { user_id: admin._id, role: admin.role },
      tokenExpiry
    );
    const refreshToken = await _jwt.signRefreshToken.call(void 0, admin._id);

    // 5. Prepare admin data to return
    const adminData = admin.toObject();
    delete adminData.password;
    delete adminData.__v;


    // 6. Send response
    res.json({ admin: adminData, accessToken, refreshToken });
  } catch (e) {
    next(e);
  }
}; exports.loginAdmin = loginAdmin;

// at top, after your other exports
 const getCurrentAdmin = async (req, res, next) => {
  try {
    // req.payload.user_id comes from your verifyAccessToken middleware
    const admin = await _admin2.default.findById(req.payload.user_id)
      .select("-password -__v");
    if (!admin) {
      return next(Boom.notFound("Admin not found."));
    }
    res.json({ admin });
  } catch (err) {
    next(err);
  }
}; exports.getCurrentAdmin = getCurrentAdmin;


 const RefreshToken = async (req, res, next) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return next(Boom.badRequest("Refresh token missing."));
  }

  try {
    const user_id = await _jwt.verifyRefreshToken.call(void 0, refresh_token);
    const accessToken = await _jwt.signAccessToken.call(void 0, user_id);
    const newRefreshToken = await _jwt.signRefreshToken.call(void 0, user_id);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (e) {
    next(e);
  }
}; exports.RefreshToken = RefreshToken;

 const createAdmin = async (req, res, next) => {
  const { username, password, role } = req.body;

  if (_optionalChain([req, 'access', _ => _.payload, 'optionalAccess', _2 => _2.role]) !== "admin") {
    return next(Boom.forbidden("Only super admins can create admins"));
  }

  try {
    const newAdmin = new (0, _admin2.default)({ username, password, role });
    await newAdmin.save();
    const adminObj = newAdmin.toObject();
    delete adminObj.password;
    delete adminObj.__v;

    res.json({ message: "Admin created", admin: adminObj });
  } catch (error) {
    next(error);
  }
}; exports.createAdmin = createAdmin;

 const updateAdminRole = async (req, res, next) => {
  const { adminId, newRole } = req.body;

  if (_optionalChain([req, 'access', _3 => _3.payload, 'optionalAccess', _4 => _4.role]) !== "admin") {
    return next(Boom.forbidden("Unauthorized"));
  }

  try {
    const updatedAdmin = await _admin2.default.findByIdAndUpdate(
      adminId,
      { level: newRole },
      { new: true }
    ).select("-password");
    res.json({ message: "Admin role updated", admin: updatedAdmin });
  } catch (error) {
    next(error);
  }
}; exports.updateAdminRole = updateAdminRole;

 const updateAdminCredentials = async (req, res, next) => {
  const { adminId, username, password } = req.body;

  if (_optionalChain([req, 'access', _5 => _5.payload, 'optionalAccess', _6 => _6.role]) !== "admin") {
    return next(Boom.forbidden("Unauthorized"));
  }

  try {
    const update = {};
    if (username) update.username = username;
    if (password) update.password = password; // will be hashed by pre-save hook

    const adminDoc = await _admin2.default.findById(adminId);
    if (!adminDoc) return next(Boom.notFound("Admin not found"));

    Object.assign(adminDoc, update);
    await adminDoc.save();

    const adminObj = adminDoc.toObject();
    delete adminObj.password;
    delete adminObj.__v;

    res.json({ message: "Admin updated", admin: adminObj });
  } catch (error) {
    next(error);
  }
}; exports.updateAdminCredentials = updateAdminCredentials;

 const deleteAdmin = async (req, res, next) => {
  const { adminId } = req.params;

  if (_optionalChain([req, 'access', _7 => _7.payload, 'optionalAccess', _8 => _8.role]) !== "admin") {
    return next(Boom.forbidden("Unauthorized"));
  }

  try {
    await _admin2.default.findByIdAndDelete(adminId);
    res.json({ message: "Admin deleted" });
  } catch (error) {
    next(error);
  }
}; exports.deleteAdmin = deleteAdmin;

 const getAllAdmins = async (req, res, next) => {
  if (_optionalChain([req, 'access', _9 => _9.payload, 'optionalAccess', _10 => _10.role]) !== "admin") {
    return next(Boom.forbidden("Unauthorized"));
  }

  try {
    const admins = await _admin2.default.find().select("-password");
    res.json(admins);
  } catch (error) {
    next(error);
  }
}; exports.getAllAdmins = getAllAdmins;

 const logoutAdmin = async (req, res, next) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return next(Boom.badRequest("Refresh token missing."));
  }

  try {
    const adminId = await _jwt.verifyRefreshToken.call(void 0, refresh_token);
    if (!adminId) {
      return next(Boom.unauthorized("Invalid refresh token."));
    }

    // Remove the stored refresh token in Redis
    await redis.del(adminId.toString());

    res.json({ message: "Logout successful" });
  } catch (e) {
    console.error("Admin logout error:", e);
    next(e);
  }
}; exports.logoutAdmin = logoutAdmin;



exports. default = {
	loginAdmin: exports.loginAdmin,
  createAdmin: exports.createAdmin,
  getAllAdmins: exports.getAllAdmins,
  deleteAdmin: exports.deleteAdmin,
  RefreshToken: exports.RefreshToken,
  updateAdminCredentials: exports.updateAdminCredentials,
  updateAdminRole: exports.updateAdminRole,
  logoutAdmin: exports.logoutAdmin,
  getCurrentAdmin: exports.getCurrentAdmin
};