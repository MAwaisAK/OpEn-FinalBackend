"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _courses = require('../../models/courses'); var _courses2 = _interopRequireDefault(_courses);
var _user = require('../../models/user'); var _user2 = _interopRequireDefault(_user);
var _notifications = require('../../models/notifications'); var _notifications2 = _interopRequireDefault(_notifications);
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

/**
 * Create a new course.
 */
 const createCourse = async (req, res, next) => {
  try {
    const { title, Author, AuthorLink, courseCategory, description, courseContent, shortdescription, price } = req.body;

    // Parse links arrays sent as JSON strings.
    const assessmentLinks = req.body.assessmentLinks ? JSON.parse(req.body.assessmentLinks) : [];
    const externalLinks = req.body.externalLinks ? JSON.parse(req.body.externalLinks) : [];
    const videosLinks = req.body.videosLinks ? JSON.parse(req.body.videosLinks) : [];
    const referenceLinks = req.body.referenceLinks ? JSON.parse(req.body.referenceLinks) : [];

    let thumbnailUrl;
    if (req.files["thumbnail"]) {
      thumbnailUrl = await handleFirebaseUpload(
        req.files["thumbnail"][0],
        "Thumbnail",
        `Course-${title}-thumbnail`
      );
    } else {
      return next(Boom.badRequest("Thumbnail file is required."));
    }

    let fileUrls = [];
    if (req.files["files"]) {
      fileUrls = await Promise.all(
        req.files["files"].map((file) =>
          handleFirebaseUpload(file, "Files", `Course-${title}-file`)
        )
      );
    }

    const course = new (0, _courses2.default)({
      title,
      Author,
      AuthorLink,
      thumbnail: thumbnailUrl,
      courseCategory,
      description,
      courseContent,
      files: fileUrls,
      assessmentLinks,
      externalLinks,
      videosLinks,
      shortdescription,
      referenceLinks,
      price,
    });

    const savedCourse = await course.save();

    // --- Notification Logic for Course Creation ---
    // Prepare notification data for course creation.
    const notificationData = `New course '${title}' has been created.`;
    // Retrieve all users' IDs.
    const users = await _user2.default.find({}, "_id");

    if (users.length) {
      // Create bulk operations for each user.
      const bulkOperations = users.map(user => ({
        updateOne: {
          filter: { user: user._id },
          update: {
            $setOnInsert: { user: user._id },
            $push: {
              type: { $each: ["coursecreate"] },
              data: { $each: [notificationData] }
            }
          },
          upsert: true
        }
      }));

      await _notifications2.default.bulkWrite(bulkOperations);
    } else {
      console.warn("No users found to send course creation notification.");
    }
    // --- End Notification Logic ---

    res.status(201).json(savedCourse);
  } catch (error) {
    console.error("Error creating course:", error);
    next(Boom.internal("Error creating course."));
  }
}; exports.createCourse = createCourse;

/**
 * Update an existing course by ID.
 */
 const updateCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const updateData = req.body;

    const updatedCourse = await _courses2.default.findByIdAndUpdate(courseId, updateData, { new: true });
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
    // Extract the course ID from the request parameters.
    const { courseId } = req.params;
    if (!courseId) {
      return next(Boom.badRequest("Course ID is required for deletion."));
    }

    // Delete the course document from the Course collection.
    const deletedCourse = await _courses2.default.findByIdAndDelete(courseId);
    if (!deletedCourse) {
      return next(Boom.notFound("Course not found."));
    }

    // Remove the course reference from each user's "courses" array.
    // This assumes that the 'courses' field in User schema is defined as:
    // courses: [{
    //    type: Schema.Types.ObjectId,
    //    ref: 'Course',
    // }],
    await _user2.default.updateMany(
      { courses: courseId },
      { $pull: { courses: courseId } }
    );

    // --- Notification Logic for Course Deletion ---
    // Prepare a notification message for the deleted course.
    const notificationData = `Course '${deletedCourse.title}' has been deleted.`;

    // Retrieve all users' IDs.
    const users = await _user2.default.find({}, "_id");

    if (users.length) {
      // Create bulk operations for each user.
      const bulkOperations = users.map((user) => ({
        updateOne: {
          filter: { user: user._id },
          update: {
            $setOnInsert: { user: user._id },
            $push: {
              type: { $each: ["coursedelete"] },
              data: { $each: [notificationData] }
            }
          },
          upsert: true
        }
      }));

      await _notifications2.default.bulkWrite(bulkOperations);
    } else {
      console.warn("No users found to send course deletion notification.");
    }
    // --- End Notification Logic ---

    res.status(200).json({
      success: true,
      message: "Course deleted successfully."
    });
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
    const course = await _courses2.default.findById(courseId);

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
    const courses = await _courses2.default.find({});
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    next(Boom.internal("Error fetching courses."));
  }
}; exports.getAllCourses = getAllCourses;

 const getAllCoursesAdmin = async (req, res, next) => {
  try {
    const courses = await _courses2.default.find({});
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    next(Boom.internal("Error fetching courses."));
  }
}; exports.getAllCoursesAdmin = getAllCoursesAdmin;

 const updateCoursesPrice = async (req, res, next) => {
  try {
    const { courseIds, newPrice } = req.body;
    const updated = await _courses2.default.updateMany(
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
    const updated = await _courses2.default.updateMany(
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
    const courses = await _courses2.default.find({ courseCategory: category });
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses by category:", error);
    next(Boom.internal("Error fetching courses by category."));
  }
}; exports.getCoursesByCategory = getCoursesByCategory;

 const getAllUserCourses = async (req, res, next) => {
  try {
    const courses = await _courses2.default.find({ status: true }).select(
      "title Author thumbnail courseCategory shortdescription status price"
    );
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    next(Boom.internal("Error fetching courses."));
  }
}; exports.getAllUserCourses = getAllUserCourses;

 const getCoursesByIds = async (req, res, next) => {
  try {
    const { courseIds } = req.body; // Expecting an array of course IDs in the request body


    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ success: false, message: "courseIds array is required." });
    }

    // Fetch courses with matching IDs
    const courses = await _courses2.default.find({
      _id: { $in: courseIds },
      status: true, // Optional: Only return active/published courses
    }).select("title Author thumbnail courseCategory shortdescription status price");

    return res.status(200).json({ success: true, courses });
  } catch (error) {
    console.error("❌ Error fetching courses by IDs:", error);
    return next(Boom.internal("Error fetching user courses."));
  }
}; exports.getCoursesByIds = getCoursesByIds;


exports. default = {
  createCourse: exports.createCourse,
  updateCourse: exports.updateCourse,
  deleteCourse: exports.deleteCourse,
  getCourseById: exports.getCourseById,
  getAllCourses: exports.getAllCourses,
  getAllUserCourses: exports.getAllUserCourses,
  updateCourseStatus: exports.updateCourseStatus,
  getCoursesByCategory: exports.getCoursesByCategory,
  updateCoursesPrice: exports.updateCoursesPrice,
  getCoursesByIds: exports.getCoursesByIds,
};
