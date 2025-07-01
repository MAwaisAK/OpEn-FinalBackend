"use strict";Object.defineProperty(exports, "__esModule", {value: true});// src/socketHandlers/privateHandlers.jsx
var _usersInstance = require('./usersInstance');

 const registerPrivateHandlers = (socket, io) => {
  socket.on('createPrivateMessage', (message) => {
    socket.broadcast.to(message.userid).emit('newPrivateMessage', {
      message: message.message,
      user: _usersInstance.users.getUser(socket.id)
    });
  });

  socket.on('privateMessageWindow', (userid) => {
    socket.broadcast.to(userid.id).emit('notifyUser', {
      user: _usersInstance.users.getUser(socket.id),
      otherUser: userid.id
    });
  });

  socket.on('private_connection_successful', (user) => {
    socket.broadcast.to(user.user.id).emit('openChatWindow', {
      user: _usersInstance.users.getUser(user.otherUserId)
    });
  });

  socket.on('privateMessageSendSuccessful', (message) => {
    const messageObject = {
      message: message.message,
      user: _usersInstance.users.getUser(message.userid),
      id: socket.id
    };
    socket.broadcast.to(message.userid).emit('privateMessageSuccessfulAdd', messageObject);
  });
}; exports.registerPrivateHandlers = registerPrivateHandlers;
