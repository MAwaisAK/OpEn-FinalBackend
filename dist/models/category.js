"use strict";Object.defineProperty(exports, "__esModule", {value: true});const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const SupportSchema = new Schema({
  support: {
    type: [String], // Array of sizes
  },
  courses: {
    type: [String], // Array of sizes
  },
  tools: {
    type: [String], // Array of sizes
  },
});

const Support = mongoose.model('categories', SupportSchema);

exports. default = Support;
