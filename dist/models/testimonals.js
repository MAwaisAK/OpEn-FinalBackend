"use strict";Object.defineProperty(exports, "__esModule", {value: true});const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const ImageSchema = new Schema({
  img: {
    type: String, // Array of sizes
  },
  name: {
    type: String, // Array of sizes
  },
  testimonal: {
    type: String, // Array of sizes
  },
});

const Testimonal = mongoose.model('testimonal', ImageSchema);

exports. default = Testimonal;
