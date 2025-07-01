"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// models/lift-ai.js
var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);
const { Schema } = _mongoose2.default;

const LiftAiSchema = new Schema(
  {
    prompt: {
      type: String,
      default:null
    }
  },
  { timestamps: true }
);

const LiftAi = _mongoose2.default.model("LiftAi", LiftAiSchema);
exports. default = LiftAi;
