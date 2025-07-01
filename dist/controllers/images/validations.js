"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _joi = require('joi'); var _joi2 = _interopRequireDefault(_joi);

const ProductSchema = _joi2.default.object({
  title: _joi2.default.string().required().messages({
    'any.required': 'Title is required',
  }),
  shortDescription: _joi2.default.string().required().messages({
    'any.required': 'Short description is required',
  }),
  longDescription: _joi2.default.string().required().messages({
    'any.required': 'Long description is required',
  }),
  price: _joi2.default.number().required().positive().messages({
    'any.required': 'Price is required',
    'number.base': 'Price must be a number',
    'number.positive': 'Price must be a positive number',
  }),
  season: _joi2.default.string().allow('').optional(), // Allow empty strings if no special condition
  gender: _joi2.default.string().required().messages({
    'any.required': 'Gender is required',
  }),
  category: _joi2.default.string().required().messages({
    'any.required': 'Category is required',
  }),
  colorcode: _joi2.default.array()
    .items(_joi2.default.string().pattern(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format, must be a valid hex code (e.g., #FFFFFF)'))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one color is required',
      'any.required': 'Color is required',
      'string.pattern.name': 'Invalid color format, must be a valid hex code (e.g., #FFFFFF)',
    }),
  colorname: _joi2.default.array().items(_joi2.default.any()).optional(),
  S: _joi2.default.array().items(_joi2.default.number().min(0)).default([]), // Array of numbers
  M: _joi2.default.array().items(_joi2.default.number().min(0)).default([]), // Array of numbers
  L: _joi2.default.array().items(_joi2.default.number().min(0)).default([]), // Array of numbers
  XL: _joi2.default.array().items(_joi2.default.number().min(0)).default([]), // Array of numbers
  XXL: _joi2.default.array().items(_joi2.default.number().min(0)).default([]), // Array of numbers
  sold: _joi2.default.string().optional(),
  sale: _joi2.default.number().optional(),
  salestatus: _joi2.default.string().optional(),
  activestatus: _joi2.default.string().optional(), // Optional if no special condition
  displayPhoto: _joi2.default.array().items(_joi2.default.any()).optional(), // No special condition
  productPhotos: _joi2.default.array().items(_joi2.default.any()).optional(), // No special condition
  largePhotos: _joi2.default.array().items(_joi2.default.any()).optional(), // No special condition
});

exports. default = ProductSchema;
