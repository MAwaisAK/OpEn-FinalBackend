"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _liftaijs = require('../../models/lift-ai.js'); var _liftaijs2 = _interopRequireDefault(_liftaijs);
var _pricejs = require('../../models/price.js'); var _pricejs2 = _interopRequireDefault(_pricejs);
var _boom = require('boom'); var _boom2 = _interopRequireDefault(_boom);
var _userjs = require('../../models/user.js'); var _userjs2 = _interopRequireDefault(_userjs);
var _userpromptsjs = require('../../models/userprompts.js'); var _userpromptsjs2 = _interopRequireDefault(_userpromptsjs);
var _bA = require('../bA');

 const chat = async (req, res, next) => {
  try {
    const { message, userId } = req.body;
    if (!userId) {
      return next(_boom2.default.badRequest("userId is required"));
    }

    // Fetch pricing config
    const pricingConfig = await _pricejs2.default.findOne();
    if (!pricingConfig) {
      return next(_boom2.default.internal("Pricing configuration not found"));
    }
    const characterPerToken = pricingConfig.Characterpertoken || 4;
    const finalDiscount = pricingConfig.FinalDiscount || 0;
    const discountMultiplier = 1 - finalDiscount / 100;

    // Estimate tokens for user's message
    const tokensForMessage = Math.ceil(message.length / characterPerToken);
    const discountedTokensForMessage =
      Math.ceil(tokensForMessage * discountMultiplier);

    // Check user's balance
    const userDoc = await _userjs2.default.findById(userId);
    if (!userDoc) {
      return next(_boom2.default.notFound("User not found"));
    }
    if ((userDoc.tokens || 0) < discountedTokensForMessage) {
      return next(_boom2.default.badRequest("Not enough tokens to send message"));
    }

    // Actually handle the AI call
    const reply = await _bA.handleUserInput.call(void 0, userId, message);

    // Short‐circuit if it's a file download
    if (typeof reply === "object" && reply.downloadUrl) {
      return res.json({ downloadUrl: reply.downloadUrl });
    }

    // Compute tokens for message + reply
    const totalChars = message.length + reply.length;
    const tokensUsed = Math.ceil(totalChars / characterPerToken);
    const discountedTokens = Math.ceil(tokensUsed * discountMultiplier);

    // === NEW: 15‐minute window logic for Prompts collection ===
    // Find the latest prompt record for this user
    let lastPrompt = await _userpromptsjs2.default.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .exec();

    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    const now = Date.now();

    let promptDoc;
    if (!lastPrompt || now - lastPrompt.createdAt.getTime() > FIFTEEN_MINUTES) {
      // Older than 15 min (or none exists) → start a brand new record
      promptDoc = new (0, _userpromptsjs2.default)({
        user: userId,
        tokens_used: tokensUsed,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Within 15 min → just increment the existing one
      lastPrompt.tokens_used += tokensUsed;
      lastPrompt.updatedAt = new Date();
      promptDoc = lastPrompt;
    }
    await promptDoc.save();

    // Deduct tokens from the user account
    userDoc.tokens = Math.max(0, (userDoc.tokens || 0) - discountedTokens);
    await userDoc.save();

    return res.json({
      reply,
      tokensUsed,
      totalTokensUsed: promptDoc.tokens_used
    });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Error processing your request" });
  }
}; exports.chat = chat;


// Get LiftAi prompt data. Always fetches from the database.
 const getPrompt = async (req, res, next) => {
  try {
    const liftAiDoc = await _liftaijs2.default.findOne();
    if (!liftAiDoc) {
      return next(_boom2.default.notFound("Prompt data not found"));
    }
    return res.status(200).json({ success: true, data: liftAiDoc });
  } catch (error) {
    return next(_boom2.default.internal("Error fetching LiftAi prompt data", error));
  }
}; exports.getPrompt = getPrompt;

// PUT /api/lift-ai/prompt
 const updatePrompt = async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return next(_boom2.default.badRequest("`prompt` is required and must be a non-empty string."));
    }

    let liftAiDoc = await _liftaijs2.default.findOne();
    if (!liftAiDoc) {
      liftAiDoc = new (0, _liftaijs2.default)({ prompt: prompt.trim() });
    } else {
      liftAiDoc.prompt = prompt.trim();
    }

    await liftAiDoc.save();
    return res.status(200).json({ success: true, data: liftAiDoc });
  } catch (error) {
    return next(_boom2.default.internal("Error updating LiftAi prompt data", error));
  }
}; exports.updatePrompt = updatePrompt;

// Get user tokens for a given user by ID.
const getUserTokens = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await _userjs2.default.findById(userId);
    if (!user) {
      return next(_boom2.default.notFound("User not found"));
    }
    return res.status(200).json({ success: true, tokens: user.tokens || 0 });
  } catch (error) {
    console.error("Error fetching user tokens:", error);
    return next(_boom2.default.internal("Error retrieving user tokens", error));
  }
};

// Get all conversation prompts for a given user.
const getAllPrompts = async (req, res, next) => {
  try {
    const prompts = await _userpromptsjs2.default.find()
      .populate("user", "username _id") // Populate user field with username and ID
      .lean(); // Convert to plain objects for easier manipulation

    return res.status(200).json({ success: true, data: prompts });
  } catch (error) {
    console.error("Error fetching all prompts:", error);
    return next(_boom2.default.internal("Error retrieving all prompts", error));
  }
};



exports. default = { chat: exports.chat, getPrompt: exports.getPrompt, updatePrompt: exports.updatePrompt, getUserTokens, getAllPrompts };
