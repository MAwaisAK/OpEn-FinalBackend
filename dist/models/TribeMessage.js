"use strict";// models/Message.js
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  chatLobbyId: {
    type: String,
    required: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
    required: true,
  },
  deletedFor: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  message: {
    type: String,
    // For text messages this is required, but for file messages, it can be empty.
    required: function() {
      return this.type === 'text';
    }
  },
  fileUrl: {
    type: String, // URL to the uploaded file (if any)
  },
  reply: {
    type: String, // URL to the uploaded file (if any)
  },
  isImage: {
    type: Boolean,
    default: false,
  },
  isVideo: {
    type: Boolean,
    default: false,
  },
  isAudio: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    enum: ['text', 'file'],
    default: 'text'
  },
  seen: {
    type: Boolean,
    default: false,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  senderUsername: {
    type: String,
    required: true,
  },
});

const Message = mongoose.model("TribeMessage", MessageSchema);
module.exports = Message;
