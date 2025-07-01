"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);
var _firebaseadmin = require('firebase-admin'); var _firebaseadmin2 = _interopRequireDefault(_firebaseadmin);
var _uuid = require('uuid');

// Initialize firebase admin (ensure your credentials are set properly)
if (!_firebaseadmin2.default.apps.length) {
  _firebaseadmin2.default.initializeApp({
    credential: _firebaseadmin2.default.credential.cert({
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const bucket = _firebaseadmin2.default.storage().bucket();

// Set up Multer with memory storage and a file size limit of 20MB
const storage = _multer2.default.memoryStorage();
const upload = _multer2.default.call(void 0, {
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB
});

// Helper function to upload a file buffer to Firebase Storage
 const uploadFileToFirebase = (file) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided"));
    }
    const fileName = `${Date.now()}-${file.originalname}`;
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          firebaseStorageDownloadTokens: _uuid.v4.call(void 0, )
        }
      }
    });

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      // Construct public URL
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
}; exports.uploadFileToFirebase = uploadFileToFirebase;

exports.upload = upload;
