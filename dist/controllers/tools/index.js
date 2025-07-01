"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _tools = require('../../models/tools'); var _tools2 = _interopRequireDefault(_tools);
var _userjs = require('../../models/user.js'); var _userjs2 = _interopRequireDefault(_userjs);
const Boom = require("boom");
var _notificationsjs = require('../../models/notifications.js'); var _notificationsjs2 = _interopRequireDefault(_notificationsjs);
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");

// Initialize Firebase only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = admin.storage().bucket();

// Function to upload files to Firebase and get the public URL
const handleFirebaseUpload = async (file, folder, nameFormat) => {
  const fileName = `${nameFormat}-${uuidv4()}-${file.originalname}`;
  const blob = bucket.file(`${folder}/${fileName}`);
  const blobStream = blob.createWriteStream({
    resumable: false,
    metadata: { contentType: file.mimetype },
  });

  return new Promise((resolve, reject) => {
    blobStream.on("error", (error) => reject(error));
    blobStream.on("finish", () => {
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
        folder + "/" + fileName
      )}?alt=media`;
      resolve(publicUrl);
    });
    blobStream.end(file.buffer);
  });
};

 const deleteFromFirebase = async (photoUrl) => {
  try {
    const decodedUrl = decodeURIComponent(photoUrl);
    const pathStartIndex = decodedUrl.indexOf("/o/") + 3;
    const pathEndIndex = decodedUrl.indexOf("?alt=media");
    const filePath = decodedUrl.slice(pathStartIndex, pathEndIndex);

    // Allow only specific folders (adjust folder names as needed)
    if (
      !filePath.startsWith("DisplayPhoto/") &&
      !filePath.startsWith("Thumbnail/") &&
      !filePath.startsWith("CourseFiles/")
    ) {
      throw new Error("Invalid file path detected. Check folder name or URL format.");
    }

    const file = bucket.file(filePath);
    await file.delete();
  } catch (error) {
    console.error("Error deleting file from Firebase Storage:", error);
  }
}; exports.deleteFromFirebase = deleteFromFirebase;

/**
 * Create a new tool.
 */
 const createTool = async (req, res, next) => {
  try {
    const { title, toolCategory, shortdescription, description, content, externalLink } = req.body;
    
    // Parse heading and details arrays (sent as JSON strings)
    const price_heading = req.body.price_heading ? JSON.parse(req.body.price_heading) : [];
    const price = req.body.price ? JSON.parse(req.body.price) : [];

    let thumbnailUrl;
    if (req.files && req.files["thumbnail"]) {
      thumbnailUrl = await handleFirebaseUpload(
        req.files["thumbnail"][0],
        "Thumbnail",
        `Tool-${title}-thumbnail`
      );
    } else {
      return next(Boom.badRequest("Thumbnail file is required."));
    }

    // Check if price_heading and price arrays are of the same length
    if (price_heading.length !== price.length) {
      return next(Boom.badRequest("Price headings and prices must have the same length."));
    }

    const tool = new (0, _tools2.default)({
      title,
      thumbnail: thumbnailUrl,
      toolCategory,
      shortdescription,
      price_heading,
      price,
      description,
      content,
      externalLink,
    });

    const savedTool = await tool.save();

    // --- Notification Logic for Tool Creation ---
    const notificationData = `New tool '${title}' has been created.`;
    // Retrieve all users' IDs.
    const users = await _userjs2.default.find({}, "_id");

    if (users.length) {
      const bulkOperations = users.map(user => ({
        updateOne: {
          filter: { user: user._id },
          update: {
            $setOnInsert: { user: user._id },
            $push: {
              type: { $each: ["toolcreate"] },
              data: { $each: [notificationData] }
            }
          },
          upsert: true
        }
      }));

      await _notificationsjs2.default.bulkWrite(bulkOperations);
    } else {
      console.warn("No users found to send tool creation notification.");
    }
    // --- End Notification Logic ---

    res.status(201).json(savedTool);
  } catch (error) {
    console.error("Error creating tool:", error);
    next(Boom.internal("Error creating tool."));
  }
}; exports.createTool = createTool;



/**
 * Update an existing tool by ID.
 */
 const updateTool = async (req, res, next) => {
  try {
    const { toolId } = req.params;
    const updateData = req.body;
    // (Optionally handle file updates and deletion of previous files here)
    const updatedTool = await _tools2.default.findByIdAndUpdate(toolId, updateData, { new: true });
    if (!updatedTool) {
      return next(Boom.notFound("Tool not found."));
    }
    res.json(updatedTool);
  } catch (error) {
    console.error("Error updating tool:", error);
    next(Boom.internal("Error updating tool."));
  }
}; exports.updateTool = updateTool;

/**
 * Delete an existing tool by ID.
 * Optionally deletes associated files from Firebase.
 */
 const deleteTool = async (req, res, next) => {
  try {
    const { toolId } = req.params;
    const tool = await _tools2.default.findById(toolId);

    if (!tool) {
      return next(Boom.notFound("Tool not found."));
    }

    // Optionally delete associated files from Firebase Storage
    if (tool.thumbnail) {
      await exports.deleteFromFirebase.call(void 0, tool.thumbnail);
    }

    await _tools2.default.findByIdAndDelete(toolId);
    res.json({ message: "Tool deleted successfully." });
  } catch (error) {
    console.error("Error deleting tool:", error);
    next(Boom.internal("Error deleting tool."));
  }
}; exports.deleteTool = deleteTool;

/**
 * Get a tool by its ID.
 */
 const getToolById = async (req, res, next) => {
  try {
    const { toolId } = req.params;
    const tool = await _tools2.default.findById(toolId);

    if (!tool) {
      return next(Boom.notFound("Tool not found."));
    }

    res.json(tool);
  } catch (error) {
    console.error("Error fetching tool:", error);
    next(Boom.internal("Error fetching tool."));
  }
}; exports.getToolById = getToolById;

/**
 * Get all tools.
 */
 const getAllTools = async (req, res, next) => {
  try {
    const tools = await _tools2.default.find({});
    res.json(tools);
  } catch (error) {
    console.error("Error fetching tools:", error);
    next(Boom.internal("Error fetching tools."));
  }
}; exports.getAllTools = getAllTools;
 const getAllToolsUsers = async (req, res, next) => {
  try {
    const tools = await _tools2.default.find({ status: true }).select(
      "title thumbnail toolCategory status price shortdescription"
    );
    res.json(tools);
  } catch (error) {
    console.error("Error fetching tools:", error);
    next(Boom.internal("Error fetching tools."));
  }
}; exports.getAllToolsUsers = getAllToolsUsers;


/**
 * Get tools by category.
 */
 const getToolsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const tools = await _tools2.default.find({ toolCategory: category });
    res.json(tools);
  } catch (error) {
    console.error("Error fetching tools by category:", error);
    next(Boom.internal("Error fetching tools by category."));
  }
}; exports.getToolsByCategory = getToolsByCategory;

/**
 * Update status of multiple tools.
 * Expects req.body.toolIds (array of IDs) and req.body.newStatus (boolean).
 */
 const updateToolStatus = async (req, res, next) => {
  try {
    const { toolIds, newStatus } = req.body;
    const updated = await _tools2.default.updateMany(
      { _id: { $in: toolIds } },
      { $set: { status: newStatus } }
    );
    res.json({ message: "Tool status updated successfully.", updated });
  } catch (error) {
    console.error("Error updating tool status:", error);
    next(Boom.internal("Error updating tool status."));
  }
}; exports.updateToolStatus = updateToolStatus;

exports. default = {
  createTool: exports.createTool,
  updateTool: exports.updateTool,
  deleteTool: exports.deleteTool,
  getToolById: exports.getToolById,
  getAllTools: exports.getAllTools,
  updateToolStatus: exports.updateToolStatus,
  getToolsByCategory: exports.getToolsByCategory,
};
