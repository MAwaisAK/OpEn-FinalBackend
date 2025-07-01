"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }const fs = require("fs");
const path = require("path");
const Boom = require("boom");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

var _images = require('../../models/images'); var _images2 = _interopRequireDefault(_images);
var _user = require('../../models/user'); var _user2 = _interopRequireDefault(_user);
var _tools = require('../../models/tools'); var _tools2 = _interopRequireDefault(_tools);
var _mytribes = require('../../models/mytribes'); var _mytribes2 = _interopRequireDefault(_mytribes);
var _courses = require('../../models/courses'); var _courses2 = _interopRequireDefault(_courses);

// Helper to save the image locally and return the URL
const saveImageLocally = async (file, folder, nameFormat) => {
  const uploadDir = path.join(__dirname, `../../public/Uploads/${folder}`);
  const ext = path.extname(file.originalname);
  const fileName = `${nameFormat}-${uuidv4()}${ext}`;
  const fullPath = path.join(uploadDir, fileName);

  // Ensure directory exists
  fs.mkdirSync(uploadDir, { recursive: true });

  // Optional: Resize with Sharp
  await sharp(file.buffer).toFile(fullPath);

  // Construct relative URL to serve
  return `/Uploads/${folder}/${fileName}`;
};

// Helper to delete image locally
const deleteLocalImage = (urlPath) => {
  try {
    const fullPath = path.join(__dirname, `../../public${urlPath}`);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error("Failed to delete local image:", err);
  }
};

class ImageController {
  static async updateLandingImage(req, res, next) {
    try {
      if (!req.files || !req.files.landingimg) {
        return next(Boom.badRequest("No landing image file provided."));
      }
      const file = req.files.landingimg[0];
      const uploadedUrl = await saveImageLocally(file, "Banners", "landing");

      let imageDoc = await _images2.default.findOne() || new (0, _images2.default)();
      if (imageDoc.landingimg) deleteLocalImage(imageDoc.landingimg);

      imageDoc.landingimg = uploadedUrl;
      await imageDoc.save();
      res.json(imageDoc);
    } catch (error) {
      console.error("Error updating landing image:", error);
      next(Boom.internal("Error updating landing image", error));
    }
  }

  static async updateLandingMiniImage(req, res, next) {
    try {
      if (!req.files || !req.files.landingminiimg) {
        return next(Boom.badRequest("No landing mini image file provided."));
      }
      const file = req.files.landingminiimg[0];
      const uploadedUrl = await saveImageLocally(file, "Banners", "landingmini");

      let imageDoc = await _images2.default.findOne() || new (0, _images2.default)();
      if (imageDoc.landingminiimg) deleteLocalImage(imageDoc.landingminiimg);

      imageDoc.landingminiimg = uploadedUrl;
      await imageDoc.save();
      res.json(imageDoc);
    } catch (error) {
      console.error("Error updating landing mini image:", error);
      next(Boom.internal("Error updating landing mini image", error));
    }
  }

  static async updateDashboardImage(req, res, next) {
    try {
      if (!req.files || !req.files.dashboardimg) {
        return next(Boom.badRequest("No dashboard image file provided."));
      }
      const file = req.files.dashboardimg[0];
      const uploadedUrl = await saveImageLocally(file, "Banners", "dashboard");

      let imageDoc = await _images2.default.findOne() || new (0, _images2.default)();
      if (imageDoc.dashboardimg) deleteLocalImage(imageDoc.dashboardimg);

      imageDoc.dashboardimg = uploadedUrl;
      await imageDoc.save();
      res.json(imageDoc);
    } catch (error) {
      console.error("Error updating dashboard image:", error);
      next(Boom.internal("Error updating dashboard image", error));
    }
  }

  static async getLandingImage(req, res, next) {
    try {
      const imageDoc = await _images2.default.findOne();
      if (!_optionalChain([imageDoc, 'optionalAccess', _ => _.landingimg])) {
        return next(Boom.notFound("Landing image not found."));
      }
      res.json({ landingimg: imageDoc.landingimg });
    } catch (error) {
      next(Boom.internal("Error fetching landing image", error));
    }
  }

  static async getLandingMiniImage(req, res, next) {
    try {
      const imageDoc = await _images2.default.findOne();
      if (!_optionalChain([imageDoc, 'optionalAccess', _2 => _2.landingminiimg])) {
        return next(Boom.notFound("Landing mini image not found."));
      }
      res.json({ landingminiimg: imageDoc.landingminiimg });
    } catch (error) {
      next(Boom.internal("Error fetching landing mini image", error));
    }
  }

  static async getDashboardImage(req, res, next) {
    try {
      const imageDoc = await _images2.default.findOne();
      if (!_optionalChain([imageDoc, 'optionalAccess', _3 => _3.dashboardimg])) {
        return next(Boom.notFound("Dashboard image not found."));
      }
      res.json({ dashboardimg: imageDoc.dashboardimg });
    } catch (error) {
      next(Boom.internal("Error fetching dashboard image", error));
    }
  }

  static async getDashboardStats(req, res, next) {
    try {
      const userCount = await _user2.default.countDocuments();
      const tools = await _tools2.default.countDocuments();
      const myTribesCount = await _mytribes2.default.countDocuments();
      const coursesCount = await _courses2.default.countDocuments();

      res.json({
        userCount,
        myTribesCount,
        tools,
        coursesCount,
      });
    } catch (error) {
      next(Boom.internal("Error fetching dashboard stats", error));
    }
  }
}

module.exports = ImageController;
