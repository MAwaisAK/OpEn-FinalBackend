"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// src/socketHandlers/chatHandlers.jsx
var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);
var _moment = require('moment'); var _moment2 = _interopRequireDefault(_moment);
var _validation = require('../utils/validation');
var _Message = require('../models/Message'); var _Message2 = _interopRequireDefault(_Message);
var _TribeMessage = require('../models/TribeMessage'); var _TribeMessage2 = _interopRequireDefault(_TribeMessage);
var _notifications = require('../models/notifications'); var _notifications2 = _interopRequireDefault(_notifications);
var _user = require('../models/user'); var _user2 = _interopRequireDefault(_user);
var _mytribesjs = require('../models/mytribes.js'); var _mytribesjs2 = _interopRequireDefault(_mytribesjs);
var _chatlobby = require('../models/chatlobby'); var _chatlobby2 = _interopRequireDefault(_chatlobby);
var _tribechatlobby = require('../models/tribechatlobby'); var _tribechatlobby2 = _interopRequireDefault(_tribechatlobby);
var _usersInstance = require('./usersInstance');
var _redisjs = require('../clients/redis.js'); var _redisjs2 = _interopRequireDefault(_redisjs);

const BUFFER_BATCH_SIZE = 10;

/**
 * Flush buffered chat messages for a room into MongoDB in bulk.
 */
async function flushChatBuffer(room) {
  const key = `chat:buffer:${room}`;
  const items = await _redisjs2.default.lrange(key, 0, -1);
  if (!items.length) return;

  const docs = items.map((raw) => {
    const p = JSON.parse(raw);
    return {
      chatLobbyId: room,
      sender:      new _mongoose2.default.Types.ObjectId(p.senderId),
      message:     p.text,
      type:        'text',
      seen:        false,
      sentAt:      new Date(p.timestamp),
    };
  });

  try {
    await _Message2.default.insertMany(docs);
    // clear deletefor once per batch
    await _chatlobby2.default.findOneAndUpdate(
      { chatLobbyId: room },
      { $set: { deletefor: [] } }
    );
  } catch (err) {
    console.error('Error bulk‐inserting chat buffer for room', room, err);
    // leave the buffer intact for retry
    return;
  }

  await _redisjs2.default.del(key);
}

/**
 * Flush buffered tribe messages for a room into MongoDB in bulk.
 */
async function flushTribeBuffer(room) {
  const key = `tribe:buffer:${room}`;
  const items = await _redisjs2.default.lrange(key, 0, -1);
  if (!items.length) return;

  const docs = items.map((raw) => {
    const p = JSON.parse(raw);
    return {
      chatLobbyId: room,
      sender:      new _mongoose2.default.Types.ObjectId(p.senderId),
      message:     p.text,
      type:        'text',
      seen:        false,
      sentAt:      new Date(p.timestamp),
    };
  });

  try {
    await _TribeMessage2.default.insertMany(docs);
    await _tribechatlobby2.default.findOneAndUpdate(
      { chatLobbyId: room },
      { $set: { deletefor: [] } }
    );
  } catch (err) {
    console.error('Error bulk‐inserting tribe buffer for room', room, err);
    return;
  }

  await _redisjs2.default.del(key);
}

 const registerChatHandlers = (socket, io) => {
  // — join a room —
  socket.on('join', (params, callback) => {
    if (
      !_validation.isRealString.call(void 0, params.name) ||
      !_validation.isRealString.call(void 0, params.room) ||
      !_validation.isRealString.call(void 0, params.userId)
    ) {
      return callback('Name, room, and userId are required.');
    }
    socket.join(params.room);
    _usersInstance.users.removeUser(socket.id);
    _usersInstance.users.addUser(socket.id, params.name, params.room, params.userId);
    io.to(params.room).emit('updateUserList', _usersInstance.users.getUserList(params.room));
    callback();
  });

  // — normal chat messages —
  socket.on('createMessage', async (message, callback) => {
    const user = _usersInstance.users.getUser(socket.id);
    if (!(user && _validation.isRealString.call(void 0, message.text))) {
      console.error('Invalid user or empty message');
      return callback();
    }

    // 1️⃣ Buffer in Redis
    const tempKey = `chat:buffer:${user.room}`;
    const buf = {
      senderId:  user.userId,
      senderName: user.name,
      text:      message.text,
      timestamp: Date.now(),
    };
    await _redisjs2.default.rpush(tempKey, JSON.stringify(buf));
    await _redisjs2.default.expire(tempKey, 3600);

    // 2️⃣ Immediate broadcast & notifications
 // include both senderId & room so clients know which lobby to update
  io.to(user.room).emit('newMessage', {
    _id:        null,
    text:       message.text,
   from:       user.name,
   sentAt:     new Date(buf.timestamp),
    seen:       false,
    type:       'text',
    senderId:   user.userId,
    chatLobbyId: user.room,
  });


    // clear deletefor
    _chatlobby2.default.findOneAndUpdate(
         { chatLobbyId: user.room },
          { 
            $set: { 
              deletefor:   [], 
              lastmsg:      message.text, 
             lastUpdated:  new Date(),
           }
     },
          { new: true }    // return the updated document
       )
        .then((updatedLobby) => {
          // emit a lobbyUpdated event so all clients can re-sort their lists
      io.emit('lobbyUpdated', {
            chatLobbyId: updatedLobby.chatLobbyId,
            lastmsg:     updatedLobby.lastmsg,
            lastUpdated: updatedLobby.lastUpdated,
          });
        })
        .catch(console.error);

    // send notifications
    _chatlobby2.default.findOne({ chatLobbyId: user.room })
      .then((lobby) => {
        if (!_optionalChain([lobby, 'optionalAccess', _ => _.participants])) return;
        lobby.participants.forEach(async (participant) => {
          if (participant.toString() === user.userId) return;
          const other = await _user2.default.findById(participant);
          if (!other) return;
          await _notifications2.default.updateOne(
            { user: participant },
            { $addToSet: { type: 'message', data: `New message from ${user.name}` } },
            { upsert: true }
          );
        });
      })
      .catch(console.error);

    // 3️⃣ Conditional bulk‐flush
    const len = await _redisjs2.default.llen(tempKey);
    if (len >= BUFFER_BATCH_SIZE) {
      await flushChatBuffer(user.room);
    }

    callback();
  });

  socket.on('tribeCreateMessage', async (data, callback) => {
    try {
      const user = _usersInstance.users.getUser(socket.id);
      if (!user || !_validation.isRealString.call(void 0, data.text)) {
        return callback('Invalid message');
      }

      // 1) Save to MongoDB
      const newMsg = await _TribeMessage2.default.create({
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
      await _tribechatlobby2.default.findOneAndUpdate(
        { chatLobbyId: user.room },
        { $set: { deletefor: [] } }
      );

      // 4) Notify other participants
      const lobby = await _tribechatlobby2.default.findOne({ chatLobbyId: user.room });
      if (_optionalChain([lobby, 'optionalAccess', _2 => _2.participants])) {
        for (const p of lobby.participants) {
          if (p.toString() === user.userId) continue;
          await _notifications2.default.updateOne(
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
    const user = _usersInstance.users.getUser(socket.id);
    if (user) {
      await flushChatBuffer(user.room);
      await flushTribeBuffer(user.room);
      _usersInstance.users.removeUser(socket.id);
      io.to(user.room).emit('updateUserList', _usersInstance.users.getUserList(user.room));
    }
  });

  // — rest of your handlers unchanged —
  socket.on("messageSeen", async ({ messageId, room, readerId }) => {
    try {
      let updatedMessage;
  
      if (messageId) {
        // normal path: client told us the exact message _id
        updatedMessage = await _Message2.default.findByIdAndUpdate(
          messageId,
          { seen: true },
          { new: true }
        );
      } else {
        // fallback: mark the most‐recent unseen message in that lobby
        updatedMessage = await _Message2.default.findOneAndUpdate(
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
      const user = data.userId;
      const tempKey = `chat:buffer:${data.chatLobbyId}`;
      const bufferItems = await _redisjs2.default.lrange(tempKey, 0, -1);
      const dataTimestamp = new Date(data.time).getTime();
  
      let foundInRedis = false;
      for (const item of bufferItems) {
        const msg = JSON.parse(item);
        if (msg.timestamp === dataTimestamp && msg.senderId === user) {
          await _redisjs2.default.lrem(tempKey, 1, item);
          io.to(data.room).emit('messageDeleted', { messageId: null, timestamp: msg.timestamp });
          foundInRedis = true;
          break;
        }
      }
      if (foundInRedis) return callback(null, "Message deleted from buffer");
  
      const msg = await _Message2.default.findById(data.messageId);
      if (!msg) return callback("Message not found");
  
      if (data.deleteType === "forEveryone") {
        const messageAge = _moment2.default.call(void 0, ).diff(_moment2.default.call(void 0, msg.sentAt), "minutes");
        if (messageAge >= 7) return callback("Deletion time window expired");
      }
  
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
  
      await _Message2.default.findByIdAndDelete(data.messageId);
      io.to(msg.chatLobbyId).emit('messageDeleted', { messageId: data.messageId });
      callback(null, "Message deleted");
    } catch (err) {
      console.error("Error deleting message:", err);
      callback("Error deleting message");
    }
  });
  


  // — DELETE tribe message —
  socket.on('deleteTribeMessage', async (data, callback) => {
    try {
      const { room, userId, messageId, deleteType } = data;
      const user = _usersInstance.users.getUser(socket.id);
      if (!user) return callback('Not authorized');

      // 1) Check admin status
      const tribe = await _mytribesjs2.default.findOne({ chatLobbyId: room }).select('admins');
      const isAdmin = _optionalChain([tribe, 'optionalAccess', _3 => _3.admins
, 'access', _4 => _4.map, 'call', _5 => _5((id) => id.toString())
, 'access', _6 => _6.includes, 'call', _7 => _7(user.userId)]);

      // 2) Load from DB
      const msg = await _TribeMessage2.default.findById(messageId);
      if (!msg) return callback('Message not found');

      // 3) Enforce 7-minute window for non-admins
      if (!isAdmin && deleteType === 'forEveryone') {
        const ageMin = _moment2.default.call(void 0, ).diff(_moment2.default.call(void 0, msg.sentAt), 'minutes');
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
}; exports.registerChatHandlers = registerChatHandlers;