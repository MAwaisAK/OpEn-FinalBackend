const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CourseSchema = new Schema({
  // Mongoose automatically adds an _id field.
  title: {
    type: String,
    required: true,
  },
  Author: {
    type: String,
    required: true,
  },
  AuthorLink: {
    type: String,
  },
  thumbnail: {
    type: String,
    required: true,
  },
  courseCategory: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  shortdescription: {
    type: String,
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  courseContent: {
    type: String,
  },
  bought: {
    type: Number,
    default:0,
  },
  status: {
    type: Boolean,
    default:true,
  },
  files: {
    // Array to hold file URLs or file identifiers.
    type: [String],
  },
  videosLinks: {
    // Array to store video URLs.
    type: [String],
  },
  assessmentLinks: {
    // Array for any additional external links.
    type: [String],
  },
  externalLinks: {
    // Array for any additional external links.
    type: [String],
  },
  referenceLinks: {
    // Array for any additional external links.
    type: [String],
  },
}, { timestamps: true });

const Course = mongoose.model("Course", CourseSchema);
export default Course;