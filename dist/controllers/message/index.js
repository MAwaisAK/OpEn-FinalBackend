"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _Message = require('../../models/Message'); var _Message2 = _interopRequireDefault(_Message);

// DELETE FOR ME: Add current user id to the message's deletedFor array.
const deleteForMe = async (req, res, next) => {
  // Expect messageId in URL parameters and current user id in req.payload.
  const { messageId } = req.params;
  if (!req.payload || !req.payload.user_id) {
    return res.status(401).json({ error: "Unauthorized: No user payload" });
  }
  const { user_id } = req.payload;
  try {
    const updatedMessage = await _Message2.default.findByIdAndUpdate(
      messageId,
      { $addToSet: { deletedFor: user_id } }, // add user id if not already present
      { new: true }
    );
    if (!updatedMessage) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(updatedMessage);
  } catch (e) {
    next(e);
  }
};

const markMessagesSeen = async (req, res) => {
  const { chatLobbyId } = req.params;
  try {
    // Fetch all messages in the chat lobby, oldest first.
    const messages = await _Message2.default.find({ chatLobbyId }).sort({ sentAt: 1 });
    const updateIds = [];
    
    // Loop through messages until a message with seen === true is found.
    for (const msg of messages) {
      if (!msg.seen) {
        updateIds.push(msg._id);
      } else {
        // Stop the loop if a message is already marked as seen.
        break;
      }
    }
    
    // Update the collected messages to mark them as seen.
    if (updateIds.length > 0) {
      await _Message2.default.updateMany({ _id: { $in: updateIds } }, { $set: { seen: true } });
    }
    
    return res.status(200).json({ message: "Messages marked as seen." });
  } catch (error) {
    console.error("Error marking messages as seen:", error);
    return res.status(500).json({ error: "Server error" });
  }
};


// DELETE FOR EVERYONE: Only allow the sender to remove the message completely if within 7 minutes.
const deleteForEveryone = async (req, res, next) => {
  const { messageId } = req.params;
  if (!req.payload || !req.payload.user_id) {
    return res.status(401).json({ error: "Unauthorized: No user payload" });
  }
  const { user_id } = req.payload;
  try {
    const message = await _Message2.default.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    // Only the sender can delete for everyone.
    if (message.sender.toString() !== user_id) {
      return res.status(403).json({ error: "You are not authorized to delete for everyone" });
    }
    // Allow deletion only if the message was sent within the last 7 minutes.
    const now = new Date();
    const diffMinutes = (now - new Date(message.sentAt)) / (1000 * 60);
    if (diffMinutes > 7) {
      return res.status(403).json({ error: "Message can no longer be deleted for everyone" });
    }
    await _Message2.default.findByIdAndDelete(messageId);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

exports. default = {
  deleteForMe,
  deleteForEveryone,
  markMessagesSeen,
};
