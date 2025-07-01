"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _fileHandlers = require('../socketHandlers/fileHandlers');

const router = _express2.default.Router();

router.post('/uploadmsg', _fileHandlers.upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  try {
    const fileUrl = await _fileHandlers.uploadFileToFirebase.call(void 0, req.file);
    res.json({
      message: 'File uploaded successfully',
      file: req.file.originalname,
      fileUrl
    });
  } catch (error) {
    console.error('Firebase upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

exports. default = router;
