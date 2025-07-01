"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _reports = require('../../models/reports'); var _reports2 = _interopRequireDefault(_reports);
var _boom = require('boom'); var _boom2 = _interopRequireDefault(_boom);

const Create = async (req, res, next) => {
  return 0;
};

const List = async (req, res, next) => {
  try {
    const report = await _reports2.default.find({}).populate('user', '-password -__v').populate('items');

    res.json(report);
  } catch (e) {
    next(e);
  }
};

const GetMyReport = async (req, res, next) => {
  const { user_id } = req.payload;

  try {
    const report = await _reports2.default.find({ user: user_id }) // Change to find by user
      .populate('items'); // Populate the items only

    res.json(report);
  } catch (e) {
    next(e);
  }
};

exports. default = {
  Create,
  List,
  GetMyReport,
};
