"use strict";Object.defineProperty(exports, "__esModule", {value: true});// src/socketHandlers/index.jsx
var _chatHandlersjs = require('./chatHandlers.js');
var _privateHandlersjs = require('./privateHandlers.js');
var _fileHandlersjs = require('./fileHandlers.js');
var _audioHandlersjs = require('./audioHandlers.js');

 const registerSocketHandlers = (socket, io) => {
  _chatHandlersjs.registerChatHandlers.call(void 0, socket, io);
  _privateHandlersjs.registerPrivateHandlers.call(void 0, socket, io);
  _fileHandlersjs.registerFileHandlers.call(void 0, socket, io);
  _audioHandlersjs.registerAudioCallHandlers.call(void 0, socket, io);
}; exports.registerSocketHandlers = registerSocketHandlers;
