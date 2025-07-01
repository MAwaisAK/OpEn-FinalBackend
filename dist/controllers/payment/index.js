"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// pages/api/payment/create-payment-intent.js

var _stripe = require('stripe'); var _stripe2 = _interopRequireDefault(_stripe);
var _boom = require('boom'); var _boom2 = _interopRequireDefault(_boom);
var _price = require('../../models/price'); var _price2 = _interopRequireDefault(_price);     // Adjust path as needed
var _payment = require('../../models/payment'); var _payment2 = _interopRequireDefault(_payment); // Adjust path as needed
var _user = require('../../models/user'); var _user2 = _interopRequireDefault(_user);       // Import the User model

const stripe = new (0, _stripe2.default)(process.env.STRIPE_SECRET_KEY);

// 1. Create PaymentIntent (and update user on success)
var _courses = require('../../models/courses'); var _courses2 = _interopRequireDefault(_courses); // Ensure Course model is imported


 const createPaymentIntent = async (req, res, next) => {
  try {
    // Extract parameters from the request body.
    let { amount, packageType, paymentMethodId, userId, price, tokens, period, courseId } = req.body;

    if (!amount || !paymentMethodId || !packageType || !userId) {
      return res.status(400).json({ success: false, message: "Missing required parameters." });
    }

    const user = await _user2.default.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    
    // Prevent trial if already used
    if ((packageType === "trial" || packageType === "trail") && user.trial_used) {
      return res.status(400).json({ success: false, message: "Trial already used." });
    }

    // Get the official pricing details from your database.
    const officialPricing = await _price2.default.findOne({});
    if (!officialPricing) {
      return res.status(500).json({ success: false, message: "Pricing not configured." });
    }

    // Recalculate price and tokens based on the package type.
    if (packageType === "small") {
      price = officialPricing.small.price;
      tokens = officialPricing.small.tokens;
      amount = Math.round(price * 100);
    } else if (packageType === "large") {
      price = officialPricing.large.price;
      tokens = officialPricing.large.tokens;
      amount = Math.round(price * 100);
    } else if (packageType === "custom") {
      if (price > 10) {
        return res.status(400).json({ success: false, message: "Custom price cannot exceed $10." });
      }
      const ratio = officialPricing.custom.tokens === 0 
        ? officialPricing.custom.price 
        : (officialPricing.custom.price / officialPricing.custom.tokens);
      tokens = price / ratio;
      amount = Math.round(price * 100);
    } else if (packageType === "basic" || packageType === "premium") {
      // For subscriptions, check period. Default to monthly if not provided.
      const billingPeriod = period === "year" ? "perYear" : "perMonth";
      if (packageType === "basic") {
        price = officialPricing.basic[billingPeriod].price;
        tokens = officialPricing.basic[billingPeriod].tokens;
      } else if (packageType === "premium") {
        price = officialPricing.premium[billingPeriod].price;
        tokens = officialPricing.premium[billingPeriod].tokens;
      }
      amount = Math.round(price * 100);
    } else if (packageType === "trial" || packageType === "trail") {
      price = 0;
      tokens = 0;
      amount = 0;
    } else if (packageType === "course") {
      // Ensure courseId is provided and valid
      if (!courseId) {
        return res.status(400).json({ success: false, message: "Missing course ID for course purchase." });
      }
    
      const course = await _courses2.default.findById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: "Course not found." });
      }
    
      // Apply discounts based on subscription
      if (user.subscription === "premium") {
        price = 0;
      } else if (user.subscription === "basic") {
        price = course.price * 0.2; // 80% off
      } else {
        price = course.price; // full price
      }
    
      amount = Math.round(price * 100);
      tokens = 0; // No tokens for course purchases
    }
     else {
      return res.status(400).json({ success: false, message: "Invalid package type." });
    }

    // Create the PaymentIntent on Stripe.
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card"],
      metadata: {
        packageType,
        userId,
        price: price.toString(),
        tokens: tokens.toString(),
        period: period || "month",
        course: packageType === "course" ? courseId : null,
      },
    });

    // Generate a unique simple payment id.
    const paymentCount = await _payment2.default.countDocuments({});
    const uniquePaymentId = `P-${1000 + paymentCount + 1}`;

    // Save a Payment record in your database.
    await _payment2.default.create({
      user: userId,
      data: packageType,
      paymentid: uniquePaymentId,
      payment: price,
      paymentIntentId: paymentIntent.id,
      tokens: tokens.toString(),
      status: "paid",
      period: (packageType === "basic" || packageType === "premium") ? (period || "month") : undefined,
      course: packageType === "course" ? courseId : null,
    });
    

    // Update the User model based on the package type.
    const tokenAmount = Number(tokens);
    if (["small", "large", "custom"].includes(packageType)) {
      await _user2.default.findByIdAndUpdate(userId, { $inc: { tokens: tokenAmount } });
    } else if (["trial", "basic", "premium"].includes(packageType)) {
      await _user2.default.findByIdAndUpdate(userId, { 
        subscription: packageType,
        period: period,
        subscribed_At: new Date(),
        $inc: { tokens: tokenAmount }
      });
    } else if (packageType === "course") {
      // For course purchases, enroll the user by adding the course to their courses array.
      await _user2.default.findByIdAndUpdate(userId, { $push: { courses: courseId } });
      await _courses2.default.findByIdAndUpdate(courseId, { $inc: { bought: 1 } });
    }

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return next(_boom2.default.internal("Error creating payment intent."));
  }
}; exports.createPaymentIntent = createPaymentIntent;

// 2. Get All Payments with Optional Status Filter
 const getAllPaymentsWithStatus = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    // 1) Find + populate user and course
    const payments = await _payment2.default.find(filter)
      .populate("user", "username email")    // just bring in username & email
      .populate("course", "title")           // <-- populate your course field
      .lean();                               // get plain objects

    // 2) Map in a courseTitle (or "N/A")
    const updatedPayments = payments.map((p) => ({
      ...p,
      courseTitle: _nullishCoalesce(_optionalChain([p, 'access', _ => _.course, 'optionalAccess', _2 => _2.title]), () => ( "N/A")),
    }));

    return res.status(200).json({ success: true, payments: updatedPayments });
  } catch (err) {
    console.error("Error fetching payments:", err);
    return next(_boom2.default.internal("Error fetching payments."));
  }
}; exports.getAllPaymentsWithStatus = getAllPaymentsWithStatus;


// 3. Get User-Specific Payments with Optional Status Filter
 const getUserPaymentsWithStatus = async (req, res, next) => {
  try {
    const { userId, status } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing user id." });
    }
    const query = { user: userId };
    if (status) query.status = status;
    const payments = await _payment2.default.find(query).populate("user");
    return res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("Error fetching user payments:", error);
    return next(_boom2.default.internal("Error fetching user payments."));
  }
}; exports.getUserPaymentsWithStatus = getUserPaymentsWithStatus;

// 4. Update Payment Status
 const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentId, status } = req.body;
    if (!paymentId || !status) {
      return res.status(400).json({ success: false, message: "Missing required parameters." });
    }
    const payment = await _payment2.default.findByIdAndUpdate(paymentId, { status }, { new: true });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }
    return res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return next(_boom2.default.internal("Error updating payment status."));
  }
}; exports.updatePaymentStatus = updatePaymentStatus;

// 5. Refund Payment (triggered by a refund button on the frontend)
 const refundPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) {
      return res.status(400).json({ success: false, message: "Missing payment id." });
    }

    // Retrieve the Payment record
    const payment = await _payment2.default.findById(paymentId).lean();
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    const { user: userId, course, tokens, data: packageType, period, paymentIntentId } = payment;

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: "No PaymentIntent ID found." });
    }

    // Issue Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });

    // === ROLLBACK LOGIC STARTS HERE ===

    // Convert tokens back to number safely
    const tokenAmount = Number(tokens || 0);

    // Undo effects based on package type
    if (["small", "large", "custom"].includes(packageType)) {
      // Remove tokens
      await _user2.default.findByIdAndUpdate(userId, { $inc: { tokens: -tokenAmount } });

    } else if (["trial", "basic", "premium"].includes(packageType)) {
      // Reset subscription
      await _user2.default.findByIdAndUpdate(userId, {
        $set: { subscription: null, period: null, subscribed_At: null },
        $inc: { tokens: -tokenAmount }
      });

    } else if (packageType === "course") {
      // Remove course enrollment from user
      await _user2.default.findByIdAndUpdate(userId, { $pull: { courses: course } });
      // Decrement the course purchase count
      await _courses2.default.findByIdAndUpdate(course, { $inc: { bought: -1 } });
    }

    // === ROLLBACK LOGIC ENDS HERE ===

    // Mark payment as refunded
    await _payment2.default.findByIdAndUpdate(paymentId, { status: "refunded" });

    return res.status(200).json({ success: true, refund });

  } catch (error) {
    console.error("Error processing refund:", error);
    return next(_boom2.default.internal("Error processing refund."));
  }
}; exports.refundPayment = refundPayment;


 const getRevenueStats = async (req, res, next) => {
  try {
    // 1. Monthly Revenue Chart
    // Group by month and year, summing up revenue from payments with status "paid"
    const monthlyRevenue = await _payment2.default.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
          revenue: { $sum: "$payment" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // 2. Revenue from Last Week
    // Calculate date for 7 days ago from now
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find payments from the last 7 days with status "paid"
    const lastWeekPayments = await _payment2.default.find({
      status: "paid",
      createdAt: { $gte: sevenDaysAgo }
    });

    // Sum up the payment amounts to get the revenue of last week
    const lastWeekRevenue = lastWeekPayments.reduce(
      (acc, payment) => acc + payment.payment,
      0
    );

    // 3. Last 7 Payments with the user object populated (only username)
    const last7Payments = await _payment2.default.find({ status: "paid" })
      .sort({ createdAt: -1 })
      .limit(7)
      .populate("user", "username");

    return res.status(200).json({
      success: true,
      monthlyRevenue,
      lastWeekRevenue,
      last7Payments,
    });
  } catch (error) {
    console.error("Error fetching revenue stats:", error);
    return next(_boom2.default.internal("Error fetching revenue stats."));
  }
}; exports.getRevenueStats = getRevenueStats;


exports. default = {
  createPaymentIntent: exports.createPaymentIntent,
  getAllPaymentsWithStatus: exports.getAllPaymentsWithStatus,
  getUserPaymentsWithStatus: exports.getUserPaymentsWithStatus,
  updatePaymentStatus: exports.updatePaymentStatus,
  refundPayment: exports.refundPayment,
  getRevenueStats: exports.getRevenueStats,
};
