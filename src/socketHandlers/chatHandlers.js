// src/socketHandlers/chatHandlers.jsx
import mongoose from 'mongoose';
import moment from 'moment';
import { isRealString } from '../utils/validation';
import Message from '../models/Message';
import TribeMessage from '../models/TribeMessage';
import Notification from '../models/notifications';
import User from '../models/user';
import MyTribe from '../models/mytribes.js';
import ChatLobby from '../models/chatlobby';
import TribeChatLobby from '../models/tribechatlobby';
import { users } from './usersInstance';
import redis from '../clients/redis.js';

const BUFFER_BATCH_SIZE = 10;

/**
 * Flush buffered chat messages for a room into MongoDB in bulk.
 */
async function flushChatBuffer(room) {
  const key = `chat:buffer:${room}`;
  const items = await redis.lrange(key, 0, -1);
  if (!items.length) return;

  const docs = items.map((raw) => {
    const p = JSON.parse(raw);
    return {
      chatLobbyId: room,
      sender:      new mongoose.Types.ObjectId(p.senderId),
      message:     p.text,
      type:        'text',
      seen:        false,
      sentAt:      new Date(p.timestamp),
    };
  });

  try {
    await Message.insertMany(docs);
    // clear deletefor once per batch
    await ChatLobby.findOneAndUpdate(
      { chatLobbyId: room },
      { $set: { deletefor: [] } }
    );
  } catch (err) {
    console.error('Error bulk‐inserting chat buffer for room', room, err);
    // leave the buffer intact for retry
    return;
  }

  await redis.del(key);
}

/**
 * Flush buffered tribe messages for a room into MongoDB in bulk.
 */
async function flushTribeBuffer(room) {
  const key = `tribe:buffer:${room}`;
  const items = await redis.lrange(key, 0, -1);
  if (!items.length) return;

  const docs = items.map((raw) => {
    const p = JSON.parse(raw);
    return {
      chatLobbyId: room,
      sender:      new mongoose.Types.ObjectId(p.senderId),
      message:     p.text,
      type:        'text',
      seen:        false,
      sentAt:      new Date(p.timestamp),
    };
  });

  try {
    await TribeMessage.insertMany(docs);
    await TribeChatLobby.findOneAndUpdate(
      { chatLobbyId: room },
      { $set: { deletefor: [] } }
    );
  } catch (err) {
    console.error('Error bulk‐inserting tribe buffer for room', room, err);
    return;
  }

  await redis.del(key);
}

export const registerChatHandlers = (socket, io) => {
  // — join a room —
  socket.on('join', (params, callback) => {
    if (
      !isRealString(params.name) ||
      !isRealString(params.room) ||
      !isRealString(params.userId)
    ) {
      return callback('Name, room, and userId are required.');
    }
    socket.join(params.room);
    users.removeUser(socket.id);
    users.addUser(socket.id, params.name, params.room, params.userId);
    io.to(params.room).emit('updateUserList', users.getUserList(params.room));
    callback();
  });

socket.on('createMessage', async (message, callback) => {
  const user = users.getUser(socket.id);
  if (!(user && isRealString(message.text))) {
    console.error('Invalid user or empty message');
    return callback();
  }

  const tempKey = `chat:buffer:${user.room}`;

  // 1️⃣ Generate an ObjectId for both MongoDB and Redis
  const msgId = new mongoose.Types.ObjectId();
  const timestamp = Date.now();

  const buf = {
    _id:        msgId.toString(),  // include msgId in Redis for traceability
    senderId:   user.userId,
    senderName: user.name,
    text:       message.text,
    timestamp, // keep as number (UNIX ms)
  };

  await redis.rpush(tempKey, JSON.stringify(buf));
  await redis.expire(tempKey, 3600); // optional: expire after 1 hour

  // 2️⃣ Immediate broadcast to room
  io.to(user.room).emit('newMessage', {
    _id:         msgId.toString(),
    text:        message.text,
    from:        user.name,
    sentAt:      new Date(timestamp),
    seen:        false,
    type:        'text',
    senderId:    user.userId,
    chatLobbyId: user.room,
  });

  // 3️⃣ Persist to MongoDB
  try {
    const newMsg = {
      _id:    msgId, // use same ObjectId
      sender: user.userId,
      message: message.text,
      sentAt: new Date(timestamp),
    };

    const updatedLobby = await ChatLobby.findOneAndUpdate(
      { chatLobbyId: user.room },
      {
        $push: { messages: newMsg },
        $set: {
          deletefor:  [],
          lastmsg:    newMsg.message,
          lastmsgid:  msgId,
          lastUpdated: new Date(timestamp),
        }
      },
      { new: true }
    );

    io.emit('lobbyUpdated', {
      chatLobbyId: updatedLobby.chatLobbyId,
      lastmsg:     updatedLobby.lastmsg,
      lastmsgid:   updatedLobby.lastmsgid,
      lastUpdated: updatedLobby.lastUpdated,
    });

  } catch (err) {
    console.error("Error updating ChatLobby:", err);
  }

  // 4️⃣ Send notifications
  ChatLobby.findOne({ chatLobbyId: user.room })
    .then((lobby) => {
      if (!lobby?.participants) return;
      lobby.participants.forEach(async (participant) => {
        if (participant.toString() === user.userId) return;
        const other = await User.findById(participant);
        if (!other) return;
        await Notification.updateOne(
          { user: participant },
          { $addToSet: {
              type: 'message',
              data: `New message from ${user.name}`,
            }
          },
          { upsert: true }
        );
      });
    })
    .catch(console.error);

  // 5️⃣ Conditional flush if buffer exceeds threshold
  const len = await redis.llen(tempKey);
  if (len >= BUFFER_BATCH_SIZE) {
    await flushChatBuffer(user.room);
  }

  callback();
});


  socket.on('tribeCreateMessage', async (data, callback) => {
    try {
      const user = users.getUser(socket.id);
      if (!user || !isRealString(data.text)) {
        return callback('Invalid message');
      }

      // 1) Save to MongoDB
      const newMsg = await TribeMessage.create({
        chatLobbyId: user.room,
        sender:      user.userId,
        message:     data.text,
        type:        'text',
        seen:        false,
        senderUsername: user.name,
        sentAt:      new Date(),
      });

      // 2) Broadcast to everyone with real IDs
      io.to(user.room).emit('newTribeMessage', {
        _id:       newMsg._id.toString(),
        text:      newMsg.message,
        from:      user.name,
        senderUsername:  newMsg.senderUsername,
        senderId:  user.userId,
        sentAt:    newMsg.sentAt,
        seen:      newMsg.seen,
        type:      newMsg.type,
      });

      // 3) (Optional) clear any "deletefor" flags
      await TribeChatLobby.findOneAndUpdate(
        { chatLobbyId: user.room },
        { $set: { deletefor: [] } }
      );

      // 4) Notify other participants
      const lobby = await TribeChatLobby.findOne({ chatLobbyId: user.room });
      if (lobby?.participants) {
        for (const p of lobby.participants) {
          if (p.toString() === user.userId) continue;
          await Notification.updateOne(
            { user: p },
            { $addToSet: { type: 'message', data: `New tribe message from ${user.name}` } },
            { upsert: true }
          );
        }
      }

      callback(null, newMsg);
    } catch (err) {
      console.error('tribeCreateMessage error:', err);
      callback('Server error');
    }
  });

  // — on disconnect: flush any remaining buffers —
  socket.on('disconnect', async () => {
    const user = users.getUser(socket.id);
    if (user) {
      await flushChatBuffer(user.room);
      await flushTribeBuffer(user.room);
      users.removeUser(socket.id);
      io.to(user.room).emit('updateUserList', users.getUserList(user.room));
    }
  });

  // — rest of your handlers unchanged —
  socket.on("messageSeen", async ({ messageId, room, readerId }) => {
    try {
      let updatedMessage;
  
      if (messageId) {
        // normal path: client told us the exact message _id
        updatedMessage = await Message.findByIdAndUpdate(
          messageId,
          { seen: true },
          { new: true }
        );
      } else {
        // fallback: mark the most‐recent unseen message in that lobby
        updatedMessage = await Message.findOneAndUpdate(
          { chatLobbyId: room, seen: false },
          { seen: true },
          { sort: { sentAt: -1 }, new: true }
        );
      }
  
      if (!updatedMessage) return;
  
      // broadcast back to everyone in the room (including the sender)
      io.to(room).emit("messageUpdated", {
        _id:        updatedMessage._id,
        chatLobbyId: room,
        seen:       true,
      });
    } catch (err) {
      console.error("Error marking message seen:", err);
    }
  });
  
  

  // New deleteMessage event handler
socket.on('deleteMessage', async (data, callback) => {
  try {
        const userId = data.userId;
    const tempKey = `chat:buffer:${data.chatLobbyId}`;
    const bufferItems = await redis.lrange(tempKey, 0, -1);

    for (const item of bufferItems) {
      const msg = JSON.parse(item);

      // Match by Redis message _id and senderId
      if (msg._id === data.messageId && msg.senderId === userId) {
        // 1️⃣ Remove from Redis buffer
        await redis.lrem(tempKey, 1, item);

        // 2️⃣ Update the ChatLobby’s last message to “deleted”
        const deletedText = '<i>*Message Deleted*</i>';
        const now = new Date();
        const updatedLobby = await ChatLobby.findOneAndUpdate(
          { chatLobbyId: data.chatLobbyId },
          {
            $set: {
              lastmsg: deletedText,
              lastmsgid: null,
              lastUpdated: now
            }
          },
          { new: true }
        );

        // 3️⃣ Broadcast both lobby update and message deletion
        io.emit('lobbyUpdated', {
          chatLobbyId: updatedLobby.chatLobbyId,
          lastmsg:     updatedLobby.lastmsg,
          lastmsgid:   updatedLobby.lastmsgid,
          lastUpdated: updatedLobby.lastUpdated,
        });
        io.to(data.chatLobbyId).emit('messageDeleted', {
          messageId: msg._id,
          timestamp: msg.timestamp
        });

        // 4️⃣ Finish
        return callback(null, 'Message deleted from Redis buffer');
      }
    }

    if (foundInRedis) return callback(null, "Message deleted from Redis buffer");

    // If not found in Redis, try MongoDB
    const msg = await Message.findById(data.messageId);
    if (!msg) return callback("Message not found");

    // Enforce deletion rules
    if (data.deleteType === "forEveryone") {
      const messageAge = moment().diff(moment(msg.sentAt), "minutes");
      if (messageAge >= 7) return callback("Deletion time window expired");
    }

    // Optional file deletion (if file type)
    if (msg.type === "file" && msg.fileUrl && data.deleteType === "forEveryone") {
      try {
        const urlObj = new URL(msg.fileUrl);
        const encodedFileName = urlObj.pathname.split('/o/')[1];
        const fileName = decodeURIComponent(encodedFileName.split('?')[0]);
        await bucket.file(fileName).delete();
      } catch (fileDelErr) {
        console.error("Error deleting file from Firebase:", fileDelErr);
      }
    }

    // Update chat lobby last message
    const deletedText = "<i>*Message Deleted*</i>";
    const now = new Date();
    const updated = await ChatLobby.findOneAndUpdate(
      { chatLobbyId: msg.chatLobbyId },
      {
        $set: {
          lastmsg: deletedText,
          lastmsgid: null,
          lastUpdated: now,
        }
      },
      { new: true }
    );

    // Notify all clients
    io.emit('lobbyUpdated', {
      chatLobbyId: updated.chatLobbyId,
      lastmsg: updated.lastmsg,
      lastmsgid: updated.lastmsgid,
      lastUpdated: updated.lastUpdated,
    });

    // Final delete
    await Message.findByIdAndDelete(data.messageId);
    io.to(msg.chatLobbyId).emit('messageDeleted', { messageId: data.messageId });

    callback(null, "Message deleted from MongoDB");
  } catch (err) {
    console.error("Error deleting message:", err);
    callback("Error deleting message");
  }
});



  // — DELETE tribe message —
  socket.on('deleteTribeMessage', async (data, callback) => {
    try {
      const { room, userId, messageId, deleteType } = data;
      const user = users.getUser(socket.id);
      if (!user) return callback('Not authorized');

      // 1) Check admin status
      const tribe = await MyTribe.findOne({ chatLobbyId: room }).select('admins');
      const isAdmin = tribe?.admins
        .map((id) => id.toString())
        .includes(user.userId);

      // 2) Load from DB
      const msg = await TribeMessage.findById(messageId);
      if (!msg) return callback('Message not found');

      // 3) Enforce 7-minute window for non-admins
      if (!isAdmin && deleteType === 'forEveryone') {
        const ageMin = moment().diff(moment(msg.sentAt), 'minutes');
        if (ageMin >= 7) return callback('Deletion window expired');
      }

      // 4) (Optional) delete file from storage if msg.type === 'file'

      // 5) Remove and broadcast
      await msg.deleteOne();
      io.to(room).emit('messageDeleted', { messageId });

      callback(null, 'Deleted');
    } catch (err) {
      console.error('deleteTribeMessage error:', err);
      callback('Server error');
    }
  });
};