// fileHandlers.js

import { users } from './usersInstance';
import mongoose from 'mongoose';
import Message from '../models/Message';
import TribeMessage from '../models/TribeMessage';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import ChatLobby from '../models/chatlobby';
import { Storage } from '@google-cloud/storage';
import redis from '../clients/redis.js';

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
      const msgId = new mongoose.Types.ObjectId();

      // Determine file type
      const imageRegex = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
      const videoRegex = /\.(mp4|mov|avi|mkv)(\?.*)?$/i;
      const isImage = fileData.mimetype?.startsWith('image/') ?? imageRegex.test(fileData.fileUrl);
      const isVideo = fileData.mimetype?.startsWith('video/') ?? videoRegex.test(fileData.fileUrl);

      // Save message
      const msgDoc = new Message({
        _id: msgId,
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
        _id: msgId.toString(),
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
            deletefor: [],
            lastmsg: lastmsgText,
            lastUpdated: new Date(),
          }
        },
        { new: true }  // return the updated document
      )
        .then((updatedLobby) => {
          io.emit('lobbyUpdated', {
            chatLobbyId: updatedLobby.chatLobbyId,
            lastmsg: updatedLobby.lastmsg,
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
      const msgId = new mongoose.Types.ObjectId();

      const imageRegex = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
      const videoRegex = /\.(mp4|mov|avi|mkv)(\?.*)?$/i;
      const isImage = fileData.mimetype?.startsWith('image/') ?? imageRegex.test(fileData.fileUrl);
      const isVideo = fileData.mimetype?.startsWith('video/') ?? videoRegex.test(fileData.fileUrl);

      const msgDoc = new TribeMessage({
        _id: msgId,
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
        senderId: senderId,
        url: fileData.fileUrl,
        sentAt: msgDoc.sentAt,
        isImage,
        isVideo,
        _id: msgId.toString(),
      });

      callback && callback();
    } catch (err) {
      console.error("Error saving tribe file message:", err);
      callback && callback("Error saving file message");
    }
  });

};
