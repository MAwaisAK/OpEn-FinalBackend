"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _support = require('../../models/support'); var _support2 = _interopRequireDefault(_support); // Your model file exporting the Mytriber (support) model
const Boom = require("boom");

/**
 * Create a new report.
 * Expects fields: type, members (optional array), Description, and (optionally) status.
 * If status is not provided, it defaults to "pending".
 */
 const createReport = async (req, res, next) => {
  try {
    const { type, user, Description, status } = req.body;

    if (!type || !Description) {
      return next(Boom.badRequest("Type and Description are required."));
    }

    // Generate a unique 6-digit ticket number (tickno)
    let tickno;
    let digits = 6;
    let uniqueFound = false;
    
    while (!uniqueFound) {
      // Calculate the minimum and maximum numbers for the current digit length.
      const min = Math.pow(10, digits - 1);
      const max = Math.pow(10, digits) - 1;
    
      // Check if all possible numbers in this range are already taken.
      const rangeCount = await _support2.default.countDocuments({ tickno: { $gte: min, $lte: max } });
      const totalPossible = max - min + 1;
      if (rangeCount >= totalPossible) {
        // All numbers for this digit length are taken, increase the digit count.
        digits++;
        continue;
      }
    
      // Generate a random number within the current range.
      tickno = Math.floor(Math.random() * (max - min + 1)) + min;
    
      // Check if the generated tickno already exists.
      const reportExists = await _support2.default.findOne({ tickno });
      if (!reportExists) {
        uniqueFound = true;
      }
    }
    
    

    const report = new (0, _support2.default)({
      type,
      tickno, // Assign the generated ticket number
      user: user || [], // In your model, user is expected to be an ObjectId
      status: status || "pending", // Default status is "pending"
      Description,
    });

    const savedReport = await report.save();
    res.status(201).json(savedReport);
  } catch (error) {
    console.error("Error creating report:", error);
    next(Boom.internal("Error creating report."));
  }
}; exports.createReport = createReport;

/**
 * Update an existing report by ID.
 */
 const updateReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const updateData = req.body;
    const updatedReport = await _support2.default.findByIdAndUpdate(reportId, updateData, { new: true });
    if (!updatedReport) {
      return next(Boom.notFound("Report not found."));
    }
    res.json(updatedReport);
  } catch (error) {
    console.error("Error updating report:", error);
    next(Boom.internal("Error updating report."));
  }
}; exports.updateReport = updateReport;

/**
 * Delete an existing report by ID.
 */
 const deleteReport = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const report = await _support2.default.findById(reportId);

    if (!report) {
      return next(Boom.notFound("Report not found."));
    }

    await _support2.default.findByIdAndDelete(reportId);
    res.json({ message: "Report deleted successfully." });
  } catch (error) {
    console.error("Error deleting report:", error);
    next(Boom.internal("Error deleting report."));
  }
}; exports.deleteReport = deleteReport;

/**
 * Get a report by its ID.
 */
 const getReportById = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    const report = await _support2.default.findById(reportId);

    if (!report) {
      return next(Boom.notFound("Report not found."));
    }

    res.json(report);
  } catch (error) {
    console.error("Error fetching report:", error);
    next(Boom.internal("Error fetching report."));
  }
}; exports.getReportById = getReportById;

/**
 * Get all reports with user details (username and subscription).
 */
 const getAllReports = async (req, res, next) => {
  try {
    const reports = await _support2.default.find({}).populate('user', 'username subscription');
    res.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    next(Boom.internal("Error fetching reports."));
  }
}; exports.getAllReports = getAllReports;

/**
 * Update status of multiple reports.
 * Expects req.body.reportIds (array of IDs) and req.body.newStatus (string).
 */
 const updateReportStatus = async (req, res, next) => {
  try {
    const { reportIds, newStatus } = req.body;
    const updated = await _support2.default.updateMany(
      { _id: { $in: reportIds } },
      { $set: { status: newStatus } }
    );
    res.json({ message: "Report status updated successfully.", updated });
  } catch (error) {
    console.error("Error updating report status:", error);
    next(Boom.internal("Error updating report status."));
  }
}; exports.updateReportStatus = updateReportStatus;

// controllers/support.js
 const getReportsForUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return next(Boom.unauthorized("User ID is required."));
    }
    const reports = await _support2.default.find({ user: userId });
    return res.json({ reports });
  } catch (error) {
    console.error("Error fetching reports for user:", error);
    return next(Boom.internal("Error fetching reports for user."));
  }
}; exports.getReportsForUser = getReportsForUser;


 const getStatusForUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return next(Boom.badRequest("User ID is required."));
    }
    // Find all reports for the given user ID, selecting only the "status" field.
    const reports = await _support2.default.find({ user: userId }, "status");
    res.json(reports);
  } catch (error) {
    console.error("Error fetching report status for user:", error);
    next(Boom.internal("Error fetching report status for user."));
  }
}; exports.getStatusForUser = getStatusForUser;

 const getLastFourReports = async (req, res, next) => {
  try {
    const latestReports = await _support2.default.find({})
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(4)
      .populate("user", "username profile_pic"); // Only fetch username and profilePic from User

    res.status(200).json({
      success: true,
      reports: latestReports,
    });
  } catch (error) {
    console.error("Error fetching last four reports:", error);
    next(Boom.internal("Failed to fetch recent reports."));
  }
}; exports.getLastFourReports = getLastFourReports;

exports. default = {
  createReport: exports.createReport,
  updateReport: exports.updateReport,
  deleteReport: exports.deleteReport,
  getReportById: exports.getReportById,
  getAllReports: exports.getAllReports,
  updateReportStatus: exports.updateReportStatus,
  getReportsForUser: exports.getReportsForUser,
  getStatusForUser: exports.getStatusForUser,
  getLastFourReports: exports.getLastFourReports,
};