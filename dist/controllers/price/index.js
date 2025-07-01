"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _price = require('../../models/price'); var _price2 = _interopRequireDefault(_price);
// Get pricing details for small, large, and custom tiers.
const getSmallLargeCustomPricing = async () => {
  try {
    const priceDoc = await _price2.default.findOne();
    if (!priceDoc) {
      // Return default values if no document is found.
      return {
        small: { price: 0, tokens: 0 },
        large: { price: 0, tokens: 0 },
        custom: { price: 0.3, tokens: 0 },
      };
    }
    return {
      small: priceDoc.small,
      large: priceDoc.large,
      custom: priceDoc.custom,
    };
  } catch (error) {
    throw error;
  }
};

// Get pricing details for basic and premium tiers.
const getBasicPremiumPricing = async () => {
  try {
    const priceDoc = await _price2.default.findOne();
    if (!priceDoc) {
      return {
        basic: {
          perMonth: { price: 0, tokens: 0 },
          perYear: { price: 0, tokens: 0 },
        },
        premium: {
          perMonth: { price: 0, tokens: 0 },
          perYear: { price: 0, tokens: 0 },
        },
      };
    }
    return {
      basic: priceDoc.basic,
      premium: priceDoc.premium,
    };
  } catch (error) {
    throw error;
  }
};

// Update all pricing fields at once.
// pricingData should be an object matching the Price schema structure.
const updatePricing = async (pricingData) => {
  try {
    const updatedDoc = await _price2.default.findOneAndUpdate({}, pricingData, {
      new: true,
      upsert: true,
    });
    return updatedDoc;
  } catch (error) {
    throw error;
  }
};

// Get the entire pricing document (all fields) at once.
const getAllPricing = async () => {
  try {
    const priceDoc = await _price2.default.findOne();
    if (!priceDoc) {
      return {
        small: { price: 0, tokens: 0 },
        large: { price: 0, tokens: 0 },
        custom: { price: 0.3, tokens: 0 },
        basic: {
          perMonth: { price: 0, tokens: 0 },
          perYear: { price: 0, tokens: 0 },
        },
        premium: {
          perMonth: { price: 0, tokens: 0 },
          perYear: { price: 0, tokens: 0 },
        },
      };
    }
    return priceDoc;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getSmallLargeCustomPricing,
  getBasicPremiumPricing,
  updatePricing,
  getAllPricing,
};
