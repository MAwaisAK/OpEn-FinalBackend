"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _jquery = require('jquery');

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    toJSON: false,
  },
  username: {
    type: String,
    required: true,
    unique:true,
  },
  profile_pic: {
    type: String,
  },
  display_banner: {
    type: String,
  },
  title: {
    type: String,
  },
  bio: {
    type: String,
  },
  subscription: {
    type: String,
    default:"none",
  },
  trial_used: {
    type: Boolean,
    default:false,
  },
  firstName: {
    type: String,
    default: null,
  },
  lastName: {
    type: String,
    default: null,
  },
  verificationToken: {
    type: String,
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  country: {
    type: String,
  },
  gender: {
    type: String,
  },
  business_country: {
    type: [String],
    default: null,
  },
  business_industry: {
    type: [String],
    default: null,
  },
  value_chainstake: {
    type: [String],
    default: null,
  },
  markets_covered: {
    type: [String],
    default: null,
  },
  immediate_needs: {
    type: [String],
    default: null,
  },
  verified: {
    type: String,
    required: true,
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  privacy: {
    type: String,
    default: "public",
    enum: ["public", "private","triber_only"],
  },
  phone: {
    type: [String],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  subscribed_At: {
    type: Date,
    default: Date.now,
  },
  subscribed_time : {
    type: String,
  },
  joined_tribes: [{
    type: Schema.Types.ObjectId,
    ref: 'Mytribe', // Reference with correct capitalization
  }],
  admin_tribes: [{
    type: Schema.Types.ObjectId,
    ref: 'Mytribe', // Reference with correct capitalization
  }],
  blockedbytribe: [{
    type: Schema.Types.ObjectId,
    ref: 'Mytribe', // Reference with correct capitalization
  }],
  courses: [{
    type: Schema.Types.ObjectId,
    ref: 'Course', // Reference with correct capitalization
  }],
  tools: [{
    type: Schema.Types.ObjectId,
    ref: 'Tool', // Reference with correct capitalization
  }],
  primary_business: {
    type: String,
  },
  status: {
    type: String,
    default:"active",
  },
  facebook_link: {
    type: String,
  },
  linkedin_link: {
    type: String,
  },
  instagram_link: {
    type: String,
  },
  x_link: {
    type: String,
  },
  web_link: {
    type: String,
  },
  account_avaialability: {
    type: Boolean,
  },
  aboutme: {
    type: String,
  },
  tokens: {
    type: Number,
  },
  subscription: {
    type: String,
    default:'none',
    enum: ["none","trial", "basic", "premium"],
  },
  period: {
    type: String,
  },
  mytribers: [{
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference with correct capitalization
  }],
  requests: [{
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference with correct capitalization
  }],
  sentrequests: [{
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference with correct capitalization
  }],
  rejectedrequests: [{
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference with correct capitalization
  }],
  blockedtribers: [{
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference with correct capitalization
  }],
  blockedby: [{
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference with correct capitalization
  }],
  chat_lobby: [{
    type: Schema.Types.ObjectId,
    ref: 'ChatLobby', // Reference with correct capitalization
  }],
  role: {
    type: String,
    default: "user",
    enum: ["user", "admin"],
  },
  level: {
    type: String,
    required: true,
    enum: ["super", "moderator", "support"],
    default: "moderator",
  },
});

UserSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(this.password, salt);
      this.password = hashed;
    }
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.isValidPass = async function (pass) {
  return await bcrypt.compare(pass, this.password);
};

const User = mongoose.model("User", UserSchema); // Ensure correct naming

exports. default = User;
