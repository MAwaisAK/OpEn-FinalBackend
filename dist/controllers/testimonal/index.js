"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _testimonals = require('../../models/testimonals'); var _testimonals2 = _interopRequireDefault(_testimonals);
const Boom = require("boom");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");

// Initialize Firebase if not already initialized
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

// Upload image to Firebase Storage
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

// Delete image from Firebase Storage
const deleteFromFirebase = async (photoUrl) => {
  try {
    const decodedUrl = decodeURIComponent(photoUrl);
    const pathStartIndex = decodedUrl.indexOf("/o/") + 3;
    const pathEndIndex = decodedUrl.indexOf("?alt=media");
    const filePath = decodedUrl.slice(pathStartIndex, pathEndIndex);
    const file = bucket.file(filePath);
    await file.delete();
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

class TestimonalController {
  // Add a new testimonial
  static async addTestimonal(req, res, next) {
    try {
      if (!req.files || !req.files.img) {
        return next(Boom.badRequest("No testimonial image file provided."));
      }

      const file = req.files.img[0];
      const uploadedUrl = await handleFirebaseUpload(file, "Testimonals", "testimonal");
      const { name, testimonal } = req.body;
      const newTestimonal = new (0, _testimonals2.default)({
        img: uploadedUrl,
        name,
        testimonal,
      });

      await newTestimonal.save();
      res.status(201).json(newTestimonal);
    } catch (error) {
      console.error("Error adding testimonial:", error);
      next(Boom.internal("Error adding testimonial"));
    }
  }

  // Get all testimonials
  static async getAllTestimonals(req, res, next) {
    try {
      const testimonals = await _testimonals2.default.find();
      res.json(testimonals);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      next(Boom.internal("Error fetching testimonials"));
    }
  }

  // Update a testimonial
  static async updateTestimonal(req, res, next) {
    try {
      const { id } = req.params;
      const { name, testimonal } = req.body;

      const existingTestimonal = await _testimonals2.default.findById(id);
      if (!existingTestimonal) {
        return next(Boom.notFound("Testimonial not found."));
      }

      if (req.files && req.files.img) {
        const file = req.files.img[0];
        const uploadedUrl = await handleFirebaseUpload(file, "Testimonals", "testimonal");

        if (existingTestimonal.img) {
          await deleteFromFirebase(existingTestimonal.img);
        }
        existingTestimonal.img = uploadedUrl;
      }

      existingTestimonal.name = name || existingTestimonal.name;
      existingTestimonal.testimonal = testimonal || existingTestimonal.testimonal;

      await existingTestimonal.save();
      res.json(existingTestimonal);
    } catch (error) {
      console.error("Error updating testimonial:", error);
      next(Boom.internal("Error updating testimonial"));
    }
  }

  // Delete a testimonial
  static async deleteTestimonal(req, res, next) {
    try {
      const { id } = req.params;

      const existingTestimonal = await _testimonals2.default.findById(id);
      if (!existingTestimonal) {
        return next(Boom.notFound("Testimonial not found."));
      }

      if (existingTestimonal.img) {
        await deleteFromFirebase(existingTestimonal.img);
      }

      await existingTestimonal.deleteOne();
      res.json({ message: "Testimonial deleted successfully." });
    } catch (error) {
      console.error("Error deleting testimonial:", error);
      next(Boom.internal("Error deleting testimonial"));
    }
  }
}

module.exports = TestimonalController;
