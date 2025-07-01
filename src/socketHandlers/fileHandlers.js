// fileHandlers.js

import { users } from './usersInstance';
import mongoose from 'mongoose';
import Message from '../models/Message';
import TribeMessage from '../models/TribeMessage';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import ChatLobby from '../models/chatlobby';
import { Storage } from '@google-cloud/storage';

// ——————————————
// 1) Google Cloud Storage Setup
// ——————————————
const gcs = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
});
const bucket = gcs.bucket(process.env.GCS_BUCKET_NAME);

export const deleteFromFirebase = async (publicUrl) => {
  try {
    const parts = publicUrl.split(`${bucket.name}/`);
    if (parts.length !== 2) {
      throw new Error(`Unexpected URL format: ${publicUrl}`);
    }
    const filePath = decodeURIComponent(parts[1]);
    await bucket.file(filePath).delete();
  } catch (err) {
    console.error("GCS deletion error:", err);
    throw new Error(`Failed to delete ${publicUrl}: ${err.message}`);
  }
};
// ——————————————
// 2) Multer Setup
// ——————————————
const memoryStorage = multer.memoryStorage();
export const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ——————————————
// 3) File Upload Helper
// ——————————————
/**
 * Upload a file buffer to GCS and return its public URL.
 * Kept name `uploadFileToFirebase` for backwards compatibility.
 */
export const uploadFileToFirebase = (file) => {
  return new Promise(async (resolve, reject) => {
    if (!file) {
      return reject(new Error("No file provided"));
    }

    try {
      // 1) Generate a unique file name
      const fileName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
      const blob = bucket.file(fileName);

      // 2) Stream the buffer into GCS
      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: { contentType: file.mimetype },
      });

      blobStream.on('error', (err) => reject(err));

      blobStream.on('finish', async () => {
        // 4) Build public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(fileName)}`;
        resolve(publicUrl);
      });

      blobStream.end(file.buffer);
    } catch (err) {
      reject(err);
    }
  });
};

// ——————————————
// 4) Socket.IO File Handlers
// ——————————————
export const registerFileHandlers = (socket, io) => {

  // --- New File Message (1:1 chat) ---
  socket.on('newFileMessage', async (fileData, callback) => {
    const user = users.getUser(socket.id);
    if (!user || !fileData?.fileUrl) {
      return callback && callback("Invalid data");
    }

    try {
      // Validate user ID
      if (!mongoose.Types.ObjectId.isValid(user.userId)) {
        return callback("Invalid user ID");
      }
      const senderId = new mongoose.Types.ObjectId(user.userId);

      // Determine file type
      const imageRegex = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
      const videoRegex = /\.(mp4|mov|avi|mkv)(\?.*)?$/i;
      const isImage = fileData.mimetype?.startsWith('image/') ?? imageRegex.test(fileData.fileUrl);
      const isVideo = fileData.mimetype?.startsWith('video/') ?? videoRegex.test(fileData.fileUrl);

      // Save message
      const msgDoc = new Message({
        chatLobbyId: user.room,
        sender: senderId,
        message: "",
        fileUrl: fileData.fileUrl,
        isImage,
        isVideo,
        type: "file",
        sentAt: new Date(),
      });
      await msgDoc.save();

      // Broadcast
      io.to(user.room).emit('newFileMessage', {
        from: user.name,
        url: fileData.fileUrl,
        sentAt: msgDoc.sentAt,
        isImage,
        isVideo,
      });

      let lastmsgText;
    if (isImage) {
      lastmsgText = "📷 Image";
    } else if (isVideo) {
      lastmsgText = "🎬 Video";
    } else {
      lastmsgText = "📎 File";
    }

    // Update the ChatLobby’s lastmsg and lastUpdated
    ChatLobby.findOneAndUpdate(
      { chatLobbyId: user.room },
      {
        $set: {
          deletefor:   [],
          lastmsg:     lastmsgText,
          lastUpdated: new Date(),
        }
      },
      { new: true }  // return the updated document
    )
    .then((updatedLobby) => {
      io.emit('lobbyUpdated', {
        chatLobbyId: updatedLobby.chatLobbyId,
        lastmsg:     updatedLobby.lastmsg,
        lastUpdated: updatedLobby.lastUpdated,
      });
    })
    .catch(console.error);

      callback && callback();
    } catch (err) {
      console.error("Error saving file message:", err);
      callback && callback("Error saving file message");
    }
  });

  // --- New File Message (Tribe chat) ---
  socket.on('tribeNewFileMessage', async (fileData, callback) => {
    const user = users.getUser(socket.id);
    if (!user || !fileData?.fileUrl) {
      return callback && callback("Invalid data");
    }

    try {
      if (!mongoose.Types.ObjectId.isValid(user.userId)) {
        return callback("Invalid user ID");
      }
      const senderId = new mongoose.Types.ObjectId(user.userId);

      const imageRegex = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
      const videoRegex = /\.(mp4|mov|avi|mkv)(\?.*)?$/i;
      const isImage = fileData.mimetype?.startsWith('image/') ?? imageRegex.test(fileData.fileUrl);
      const isVideo = fileData.mimetype?.startsWith('video/') ?? videoRegex.test(fileData.fileUrl);

      const msgDoc = new TribeMessage({
        chatLobbyId: user.room,
        sender: senderId,
        senderUsername: user.name,
        message: "",
        fileUrl: fileData.fileUrl,
        isImage,
        isVideo,
        type: "file",
        sentAt: new Date(),
      });
      await msgDoc.save();

      io.to(user.room).emit('tribeNewFileMessage', {
        from: user.name,
        url: fileData.fileUrl,
        sentAt: msgDoc.sentAt,
        isImage,
        isVideo,
      });

      callback && callback();
    } catch (err) {
      console.error("Error saving tribe file message:", err);
      callback && callback("Error saving file message");
    }
  });

  // --- Delete Message (1:1 chat) ---
 socket.on('deleteMessage', async (data, callback) => {
    try {
      const msg = await Message.findById(data.messageId);
      if (!msg) return callback("Message not found");

      // If it’s a file and deleteForEveryone, remove from GCS
      if (msg.type === "file" && msg.fileUrl && data.deleteType === "forEveryone") {
        try {
          await deleteFromFirebase(msg.fileUrl);
        } catch (delErr) {
          console.error("Error deleting file from GCS:", delErr);
        }
      }

      const chatLobbyId = msg.chatLobbyId;
      const wasLast = true;
      const lobby = await ChatLobby.findOne({ chatLobbyId });
      if (lobby && lobby.lastmsg) {
        // Compare stored lastmsg to this message
        const compareText = msg.type === 'file'
          ? (msg.isImage ? "📷 Image" : msg.isVideo ? "🎬 Video" : "📎 File")
          : msg.message;
        if (lobby.lastmsg === compareText) {
          // It was the last message; find the previous one
          const prev = await Message.find({ chatLobbyId })
            .sort({ sentAt: -1 })
            .skip(1)
            .limit(1);
          let newLast;
          if (prev.length) {
            const pm = prev[0];
            newLast = pm.type === 'file'
              ? (pm.isImage ? "📷 Image" : pm.isVideo ? "🎬 Video" : "📎 File")
              : pm.message;
          } else {
            newLast = '';
          }

          // Update lobby
          lobby.lastmsg = newLast;
          lobby.lastUpdated = new Date();
          await lobby.save();

          io.emit('lobbyUpdated', {
            chatLobbyId: lobby.chatLobbyId,
            lastmsg:     lobby.lastmsg,
            lastUpdated: lobby.lastUpdated,
          });
        }
      }

      await Message.findByIdAndDelete(data.messageId);
      io.to(chatLobbyId).emit('messageDeleted', { messageId: data.messageId });
      callback(null, "Message deleted");
    } catch (err) {
      console.error("Error deleting message:", err);
      callback("Error deleting message");
    }
  });

  // --- Delete Tribe Message ---
  socket.on('deleteTribeMessage', async (data, callback) => {
    try {
      const msg = await TribeMessage.findById(data.messageId);
      if (!msg) return callback("Message not found");

      if (msg.type === "file" && msg.fileUrl && data.deleteType === "forEveryone") {
        try {
          await deleteFromFirebase(msg.fileUrl);
        } catch (delErr) {
          console.error("Error deleting tribe file from GCS:", delErr);
        }
      }

      await TribeMessage.findByIdAndDelete(data.messageId);
      io.to(msg.chatLobbyId).emit('tribeMessageDeleted', { messageId: data.messageId });
      callback(null, "Tribe message deleted");
    } catch (err) {
      console.error("Error deleting tribe message:", err);
      callback("Error deleting message");
    }
  });
};
