// storage.js
import Course from "../../models/courses";
import User from "../../models/user";
import Notification from "../../models/notifications";
import Boom from "@hapi/boom"; // Preferred
const { v4: uuidv4 } = require("uuid");

// Google Cloud Storage client
const { Storage } = require("@google-cloud/storage");

// Instantiate once (will pick up GOOGLE_APPLICATION_CREDENTIALS)
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID, // make sure this is set in .env
});
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);


// Function to upload files to GCS and get the public URL
export const handleFirebaseUpload = async (file, folder, nameFormat) => {
  const fileName = `${nameFormat}-${uuidv4()}-${file.originalname}`;
  const filePath = `${folder}/${fileName}`;
  const blob = bucket.file(filePath);

  // Upload buffer
  await blob.save(file.buffer, {
    resumable: false,
    metadata: { contentType: file.mimetype },
  });
  // Return the public URL
  return `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(filePath)}`;
};

// Function to delete files from GCS given the public URL
export const deleteFromFirebase = async (publicUrl) => {
  try {
    // Extract the path after bucket name
    const parts = publicUrl.split(`${bucket.name}/`);
    if (parts.length !== 2) throw new Error(`Unexpected URL format: ${publicUrl}`);
    const filePath = decodeURIComponent(parts[1]);

    await bucket.file(filePath).delete();
  } catch (err) {
    console.error("GCS deletion error:", err);
    // Re-throw with original message for debugging
    throw new Error(`Failed to delete ${publicUrl}: ${err.message}`);
  }
};


/**
 * Create a new course.
 */
export const createCourse = async (req, res, next) => {
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

    const course = new Course({
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
    const users = await User.find({}, "_id");

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

      await Notification.bulkWrite(bulkOperations);
    } else {
      console.warn("No users found to send course creation notification.");
    }
    // --- End Notification Logic ---

    res.status(201).json(savedCourse);
  } catch (error) {
    console.error("Error creating course:", error);
    next(Boom.internal("Error creating course."));
  }
};

/**
 * Update an existing course by ID.
 */
export const updateCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    // Fetch existing course
    const course = await Course.findById(courseId);
    if (!course) return next(Boom.notFound("Course not found."));

    // Update simple fields
    const {
      title,
      Author,
      AuthorLink,
      courseCategory,
      shortdescription,
      description,
      courseContent,
      price,
      filesToRemove,
    } = req.body;

    course.title = title;
    course.Author = Author;
    course.AuthorLink = AuthorLink;
    course.courseCategory = courseCategory;
    course.shortdescription = shortdescription;
    course.description = description;
    course.courseContent = courseContent;
    course.price = price;

    // Remove any files flagged for removal
    if (filesToRemove) {
      const removeList = Array.isArray(filesToRemove) ? filesToRemove : [filesToRemove];
      // Delete each from storage
      await Promise.all(removeList.map(url => deleteFromFirebase(url)));
      // Filter out from course.files array
      course.files = course.files.filter(url => !removeList.includes(url));
    }

    // Handle thumbnail upload
    if (req.files['thumbnail']) {
      // Delete old thumbnail if exists
      if (course.thumbnail) {
        await deleteFromFirebase(course.thumbnail);
      }
      const thumbFile = req.files['thumbnail'][0];
      const newThumbUrl = await handleFirebaseUpload(
        thumbFile,
        'Thumbnail',
        `Course-${course.title}-thumb`
      );
      course.thumbnail = newThumbUrl;
    }

    // Handle new additional files
    if (req.files['files'] && req.files['files'].length) {
      const uploadedUrls = await Promise.all(
        req.files['files'].map(file =>
          handleFirebaseUpload(file, 'Files', `Course-${course.title}-file`)
        )
      );
      // Append to existing files
      course.files = course.files.concat(uploadedUrls);
    }

    // Overwrite link arrays
    ['assessmentLinks', 'externalLinks', 'videosLinks', 'referenceLinks'].forEach(key => {
      const val = req.body[key];
      if (val !== undefined) {
        course[key] = Array.isArray(val) ? val : [val];
      }
    });

    // Save the updated course
    const saved = await course.save();
    res.json(saved);
  } catch (error) {
    console.error('Error updating course:', error);
    next(Boom.internal('Error updating course.'));
  }
};


/**
 * Delete an existing course by ID.
 * Also removes its thumbnail + files from Firebase storage,
 * then deletes the Mongo document and cleans up user references
 */
export const deleteCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    if (!courseId) {
      return next(Boom.badRequest("Course ID is required for deletion."));
    }

    // 1) Fetch the course so we know what to delete
    const course = await Course.findById(courseId);
    if (!course) {
      return next(Boom.notFound("Course not found."));
    }

    // 2) Delete its thumbnail from GCS (if present)
    if (course.thumbnail) {
      try {
        await deleteFromFirebase(course.thumbnail);
      } catch (err) {
        console.warn("Failed to delete thumbnail from GCS:", err);
      }
    }

    // 3) Delete each file in course.files from GCS
    if (Array.isArray(course.files) && course.files.length) {
      await Promise.all(
        course.files.map(async (fileUrl) => {
          try {
            await deleteFromFirebase(fileUrl);
          } catch (err) {
            console.warn("Failed to delete file from GCS:", fileUrl, err);
          }
        })
      );
    }

    // 4) Now remove the Course document itself
    await Course.findByIdAndDelete(courseId);

    // 5) Remove course references from all users
    await User.updateMany(
      { courses: courseId },
      { $pull: { courses: courseId } }
    );

    // 6) Send a "course deleted" notification to everyone
    const notificationData = `Course '${course.title}' has been deleted.`;
    const users = await User.find({}, "_id");
    if (users.length) {
      const bulkOps = users.map((u) => ({
        updateOne: {
          filter: { user: u._id },
          update: {
            $setOnInsert: { user: u._id },
            $push: {
              type: { $each: ["coursedelete"] },
              data: { $each: [notificationData] }
            }
          },
          upsert: true
        }
      }));
      await Notification.bulkWrite(bulkOps);
    }

    return res.status(200).json({
      success: true,
      message: "Course and all attachments deleted successfully."
    });
  } catch (error) {
    console.error("Error deleting course:", error);
    return next(Boom.internal("Error deleting course."));
  }
};



/**
 * Get a course by its ID.
 */
export const getCourseById = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);

    if (!course) {
      return next(Boom.notFound("Course not found."));
    }

    res.json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    next(Boom.internal("Error fetching course."));
  }
};

/**
 * Get all courses.
 */
export const getAllCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({});
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    next(Boom.internal("Error fetching courses."));
  }
};

export const getAllCoursesAdmin = async (req, res, next) => {
  try {
    const courses = await Course.find({});
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    next(Boom.internal("Error fetching courses."));
  }
};

export const updateCoursesPrice = async (req, res, next) => {
  try {
    const { courseIds, newPrice } = req.body;
    const updated = await Course.updateMany(
      { _id: { $in: courseIds } },
      { $set: { price: newPrice } }
    );
    res.json({ message: "Courses updated successfully.", updated });
  } catch (error) {
    console.error("Error updating courses price:", error);
    next(Boom.internal("Error updating courses price."));
  }
};


/**
 * Update status of multiple courses.
 * Expects req.body.courseIds (array of IDs) and req.body.newStatus (boolean).
 */
export const updateCourseStatus = async (req, res, next) => {
  try {
    const { courseIds, newStatus } = req.body;
    const updated = await Course.updateMany(
      { _id: { $in: courseIds } },
      { $set: { status: newStatus } }
    );
    res.json({ message: "Course status updated successfully.", updated });
  } catch (error) {
    console.error("Error updating course status:", error);
    next(Boom.internal("Error updating course status."));
  }
};

/**
 * Get courses by category.
 */
export const getCoursesByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const courses = await Course.find({ courseCategory: category });
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses by category:", error);
    next(Boom.internal("Error fetching courses by category."));
  }
};

export const getAllUserCourses = async (req, res, next) => {
  try {
    const courses = await Course.find({ status: true }).select(
      "title Author thumbnail courseCategory shortdescription status price"
    );
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    next(Boom.internal("Error fetching courses."));
  }
};

export const getCoursesByIds = async (req, res, next) => {
  try {
    const { courseIds } = req.body; // Expecting an array of course IDs in the request body


    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ success: false, message: "courseIds array is required." });
    }

    // Fetch courses with matching IDs
    const courses = await Course.find({
      _id: { $in: courseIds },
      status: true, // Optional: Only return active/published courses
    }).select("title Author thumbnail courseCategory shortdescription status price");

    return res.status(200).json({ success: true, courses });
  } catch (error) {
    console.error("❌ Error fetching courses by IDs:", error);
    return next(Boom.internal("Error fetching user courses."));
  }
};


export default {
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseById,
  getAllCourses,
  getAllUserCourses,
  updateCourseStatus,
  getCoursesByCategory,
  updateCoursesPrice,
  getCoursesByIds,
};
