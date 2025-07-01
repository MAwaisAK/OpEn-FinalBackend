"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _joi = require('joi'); var _joi2 = _interopRequireDefault(_joi);

const ValidationSchema = _joi2.default.object({
  firstName: _joi2.default.string().min(2).max(50).required().messages({
    "string.empty": "First name is required.",
    "string.min": "First name must be at least 2 characters long.",
    "string.max": "First name cannot exceed 50 characters.",
  }),
  lastName: _joi2.default.string().min(2).max(50).required().messages({
    "string.empty": "Last name is required.",
    "string.min": "Last name must be at least 2 characters long.",
    "string.max": "Last name cannot exceed 50 characters.",
  }),
  username: _joi2.default.string().alphanum().min(3).max(30).required().messages({
    "string.empty": "Username is required.",
    "string.alphanum": "Username must only contain letters and numbers.",
    "string.min": "Username must be at least 3 characters long.",
    "string.max": "Username cannot exceed 30 characters.",
  }),
  email: _joi2.default.string().email().required().messages({
    "string.empty": "Email is required.",
    "string.email": "Invalid email format.",
  }),
  password: _joi2.default.string().min(8).max(30).required().messages({
    "string.empty": "Password is required.",
    "string.min": "Password must be at least 8 characters long.",
    "string.max": "Password cannot exceed 30 characters.",
  }),
  passwordConfirm: _joi2.default.string()
    .valid(_joi2.default.ref("password"))
    .required()
    .messages({
      "string.empty": "Confirm password is required.",
      "any.only": "Passwords must match.",
    }),
  country: _joi2.default.string().required().messages({
    "string.empty": "Country is required.",
  }),
  frontendUrl: _joi2.default.string(),
});

exports. default = ValidationSchema;
