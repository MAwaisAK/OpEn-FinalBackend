"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _user = require('../../models/user'); var _user2 = _interopRequireDefault(_user);

const Boom = require("boom");
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

 const updateUserDetails = async (req, res, next) => {
  try {
    const { userId } = req.params; // Extract userId from request params
    const { tokens, subscription, role, status, level } = req.body; // Data to update

    // Validate user input (Optional)
    const validSubscriptions = ["none", "basic", "premium"];
    const validRoles = ["user", "admin"];
    const validStatuses = ["active", "inactive", "suspended"];
    const validLevels = ["super", "admin", "moderator"];

    if (subscription && !validSubscriptions.includes(subscription)) {
      return next(Boom.badRequest("Invalid subscription type."));
    }
    if (role && !validRoles.includes(role)) {
      return next(Boom.badRequest("Invalid role."));
    }
    if (status && !validStatuses.includes(status)) {
      return next(Boom.badRequest("Invalid status."));
    }
    if (level && !validLevels.includes(level)) {
      return next(Boom.badRequest("Invalid level."));
    }

    // Build dynamic update object
    const updateData = {};
    if (tokens !== undefined) updateData.tokens = tokens;
    if (subscription) updateData.subscription = subscription;
    if (role) updateData.role = role;
    if (status) updateData.status = status;
    if (level) updateData.level = level;

    // Update the user and return the updated document
    const updatedUser = await _user2.default.findByIdAndUpdate(userId, updateData, {
      new: true, // Return the updated document
      runValidators: true, // Ensure Mongoose schema validations run
    });

    if (!updatedUser) {
      return next(Boom.notFound("User not found."));
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    next(Boom.internal("Error updating user."));
  }
}; exports.updateUserDetails = updateUserDetails;

 const getAllUsers = async (req, res, next) => {
  try {
    // Extract optional query parameters for filtering
    const { role, status, subscription, limit = 50, page = 1 } = req.query;

    // Build dynamic query object
    const query = {};
    if (role) query.role = role;
    if (status) query.status = status;
    if (subscription) query.subscription = subscription;

    // Pagination: Calculate skip value
    const skip = (page - 1) * limit;

    // Fetch users with filtering and pagination
    const users = await _user2.default.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-password -resetPasswordToken -resetPasswordExpires") // Exclude sensitive fields
      .populate("joined_tribes", "name") // Populate joined_tribes (optional)
      .populate("mytribers", "username email") // Populate mytribers (optional)
      .populate("chat_lobby", "name"); // Populate chat_lobby (optional)

    // Get total count for pagination metadata
    const totalUsers = await _user2.default.countDocuments(query);

    res.status(200).json({
      success: true,
      totalUsers,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalUsers / limit),
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    next(Boom.internal("Error fetching users."));
  }
}; exports.getAllUsers = getAllUsers;


/**
 * Update an existing course by ID.
 */
 const updateCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;

    const updatedCourse = await _user2.default.findByIdAndUpdate(courseId, updateData, { new: true });
    if (!updatedCourse) {
      return next(Boom.notFound("Course not found."));
    }

    res.json(updatedCourse);
  } catch (error) {
    console.error("Error updating course:", error);
    next(Boom.internal("Error updating course."));
  }
}; exports.updateCourse = updateCourse;

/**
 * Delete an existing course by ID.
 * Optionally deletes associated files from Firebase.
 */
 const deleteCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await _user2.default.findById(courseId);

    if (!course) {
      return next(Boom.notFound("Course not found."));
    }

    if (course.thumbnail) {
      await exports.deleteFromFirebase.call(void 0, course.thumbnail);
    }
    if (course.files && course.files.length > 0) {
      for (const fileUrl of course.files) {
        await exports.deleteFromFirebase.call(void 0, fileUrl);
      }
    }

    await _user2.default.findByIdAndDelete(courseId);
    res.json({ message: "Course deleted successfully." });
  } catch (error) {
    console.error("Error deleting course:", error);
    next(Boom.internal("Error deleting course."));
  }
}; exports.deleteCourse = deleteCourse;

/**
 * Get a course by its ID.
 */
 const getCourseById = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await _user2.default.findById(courseId);

    if (!course) {
      return next(Boom.notFound("Course not found."));
    }

    res.json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    next(Boom.internal("Error fetching course."));
  }
}; exports.getCourseById = getCourseById;

/**
 * Get all courses.
 */
 const getAllCourses = async (req, res, next) => {
  try {
    const courses = await _user2.default.find({});
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    next(Boom.internal("Error fetching courses."));
  }
}; exports.getAllCourses = getAllCourses;

 const getAllCoursesAdmin = async (req, res, next) => {
  try {
    const courses = await _user2.default.find({});
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    next(Boom.internal("Error fetching courses."));
  }
}; exports.getAllCoursesAdmin = getAllCoursesAdmin;

 const updateCoursesPrice = async (req, res, next) => {
  try {
    const { courseIds, newPrice } = req.body;
    const updated = await _user2.default.updateMany(
      { _id: { $in: courseIds } },
      { $set: { price: newPrice } }
    );
    res.json({ message: "Courses updated successfully.", updated });
  } catch (error) {
    console.error("Error updating courses price:", error);
    next(Boom.internal("Error updating courses price."));
  }
}; exports.updateCoursesPrice = updateCoursesPrice;


/**
 * Update status of multiple courses.
 * Expects req.body.courseIds (array of IDs) and req.body.newStatus (boolean).
 */
 const updateCourseStatus = async (req, res, next) => {
  try {
    const { courseIds, newStatus } = req.body;
    const updated = await _user2.default.updateMany(
      { _id: { $in: courseIds } },
      { $set: { status: newStatus } }
    );
    res.json({ message: "Course status updated successfully.", updated });
  } catch (error) {
    console.error("Error updating course status:", error);
    next(Boom.internal("Error updating course status."));
  }
}; exports.updateCourseStatus = updateCourseStatus;

/**
 * Get courses by category.
 */
 const getCoursesByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const courses = await _user2.default.find({ courseCategory: category });
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses by category:", error);
    next(Boom.internal("Error fetching courses by category."));
  }
}; exports.getCoursesByCategory = getCoursesByCategory;

exports. default = {
  updateCourse: exports.updateCourse,
  deleteCourse: exports.deleteCourse,
  getCourseById: exports.getCourseById,
  getAllCourses: exports.getAllCourses,
  updateCourseStatus: exports.updateCourseStatus,
  getCoursesByCategory: exports.getCoursesByCategory,
  updateCoursesPrice: exports.updateCoursesPrice,
  updateUserDetails: exports.updateUserDetails,
  getAllUsers: exports.getAllUsers,
};
