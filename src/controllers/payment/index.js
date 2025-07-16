import Stripe from "stripe";
import Boom from "@hapi/boom"; // Preferred
import Price from "../../models/price";
import Payment from "../../models/payment";
import User from "../../models/user";
import Discount from "../../models/discount"; // Import Discount model
import Course from "../../models/courses";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const validateDiscount = async (token, packageType, userId) => {
  try {
    // 1) find the discount
    const discount = await Discount.findOne({ token: token.trim().toUpperCase() });
    if (!discount) {
      return res.status(404).json({ success: false, message: "Discount code not found" });
    }

    // 2) ensure it's valid for this package
    const wantsTokens = ["small", "large", "custom"].includes(packageType);
    const wantsSubs = ["basic", "premium"].includes(packageType);
    const wantsCourse = ["course"].includes(packageType);
    const validTokens = discount.for === "tokens" && wantsTokens;
    const validSubs = discount.for === "subscription" && wantsSubs;
    const validCourse = discount.for === "course" && wantsCourse;
    if (!validTokens && !validSubs && !validCourse) {
      return res.status(400).json({ success: false, message: "Not valid for this package type" });
    }

    // 3) check usage limits
    if (discount.used_by.includes(userId)) {
      return res.status(400).json({ success: false, message: "You’ve already used this code" });
    }
    if (discount.used_by.length >= discount.numberOfUses) {
      return res.status(400).json({ success: false, message: "No remaining uses" });
    }

    // 4) success — send back the whole discount object
    return {
      value: discount.value,
      token: discount.token,
      for: discount.for
    };

  } catch (err) {
    console.error("discount validation error:", err);
    return res.status(500).json({ success: false, message: "Server error validating discount" });
  }
};


// Discount validation route
export const validateDiscountRoute = async (req, res, next) => {
  try {
    const { token, packageType, userId } = req.body;
    const discount = await validateDiscount(token, packageType, userId);
    return res.status(200).json({
      success: true,
      discount: {
        value: discount.value,
        token: discount.token,
        for: discount.for
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Main payment function
export const createPaymentIntent = async (req, res, next) => {
  try {
    let { amount, packageType, paymentMethodId, userId, price, tokens, period, courseId, discountToken } = req.body;
    if (!amount || !paymentMethodId || !packageType || !userId) {
      return res.status(400).json({ success: false, message: "Missing required parameters." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Validate discount if provided
    let discount = null;
    if (discountToken) {
      try {
        discount = await validateDiscount(discountToken, packageType, userId);
      } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
    }
    // Apply discount immediately if valid
    const officialPricing = await Price.findOne({});
    if (!officialPricing) {
      return res.status(500).json({ success: false, message: "Pricing not configured." });
    }

    // Handle subscription packages
    if (["basic", "premium"].includes(packageType)) {
      const billingPeriod = period === "year" ? "perYear" : "perMonth";
      const interval = period === "year" ? "year" : "month";

      // Get full price for new plan
      let price = officialPricing[packageType][billingPeriod].price;
      let tokens = officialPricing[packageType][billingPeriod].tokens;

      // Check for upgrade scenario
      const currentSubscription = user.stripeSubscriptionId
        ? await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
        : null;

      if (
        currentSubscription &&
        user.subscription === "basic" &&
        packageType === "premium"
      ) {
        // Cancel current subscription
        await stripe.subscriptions.cancel(currentSubscription.id);

        // Calculate remaining days
        const now = new Date();
        const end = new Date(user.nextBillingDate);
        const msInDay = 1000 * 60 * 60 * 24;
        const remainingDays = Math.max(0, Math.ceil((end - now) / msInDay));
        const totalDays = period === "year" ? 365 : 30;
        const remainingRatio = remainingDays / totalDays;

        // Prorate new premium price
        const basicPrice = officialPricing["basic"][billingPeriod].price;
        const premiumPrice = officialPricing["premium"][billingPeriod].price;
        const premiumTokens = officialPricing["premium"][billingPeriod].tokens;

        const unusedBasicValue = basicPrice * remainingRatio;
        const proratedPremiumPrice = premiumPrice * remainingRatio;

        // Subtract unused basic value and enforce $0.10 minimum, rounding down
        let finalPrice = proratedPremiumPrice - unusedBasicValue;
        finalPrice = Math.max(Math.floor(finalPrice * 100) / 100, 0.1); // Round down to avoid overcharging
        const amount = Math.round(finalPrice * 100); // Stripe uses cents

        price = Math.round(finalPrice * 100) / 100;
        tokens = Math.round(premiumTokens * remainingRatio);

      }

      // Apply discount if applicable
      if (discount && discount.for === "subscription") {
        price = price - (price * discount.value) / 100;
        price = Math.round(price * 100) / 100;
      }

      const amount = Math.round(price * 100); // Stripe expects cents

      // Ensure customer exists in Stripe
      if (!user.stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: `${user.firstName} ${user.lastName}`
        });
        user.stripeCustomerId = customer.id;
        await user.save();
      }

      // Create product & dynamic price object
      const product = await stripe.products.create({
        name: `${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Plan (${period})`
      });

      const priceObj = await stripe.prices.create({
        currency: "usd",
        unit_amount: amount,
        recurring: { interval },
        product: product.id
      });

      // Attach payment method
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: user.stripeCustomerId
      });

      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: user.stripeCustomerId,
        items: [{ price: priceObj.id }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        payment_settings: {
          save_default_payment_method: "on_subscription"
        }
      });

      let paymentIntent = subscription.latest_invoice?.payment_intent;

      // Fallback if PI is not generated
      if (!paymentIntent) {
        paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd",
          customer: user.stripeCustomerId,
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never"
          },
          metadata: {
            packageType,
            userId,
            subscriptionId: subscription.id
          }
        });
      }

      const validStatuses = ["requires_action", "requires_payment_method", "succeeded"];
      if (!validStatuses.includes(paymentIntent.status)) {
        await stripe.subscriptions.del(subscription.id);
        return res.status(402).json({
          success: false,
          message: "Subscription setup failed; payment could not be processed."
        });
      }

      // On success: record payment
      if (paymentIntent.status === "succeeded") {
        const paymentCount = await Payment.countDocuments();
        const uniquePaymentId = `P-${1000 + paymentCount + 1}`;

        await Payment.create({
          user: userId,
          data: packageType,
          paymentid: uniquePaymentId,
          payment: price,
          tokens: tokens.toString(),
          status: "paid",
          period,
          stripeSubscriptionId: subscription.id,
          discountCode: discountToken
        });

        if (discount) {
          discount.used_by.push(userId);
          discount.usesCount += 1;
          await discount.save();
        }

        // Calculate next billing date
        let nextBillingDate = new Date();
        if (interval === "month") {
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        } else if (interval === "year") {
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        }

        // Update user subscription info
        await User.findByIdAndUpdate(userId, {
          subscription: packageType,
          period,
          subscribed_At: new Date(),
          stripeSubscriptionId: subscription.id,
          nextBillingDate,
          $inc: { tokens },
          trial_used: true
        });
      }

      return res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        requiresAction: paymentIntent.status === "requires_action",
        message:
          paymentIntent.status === "succeeded"
            ? "Subscription activated successfully"
            : "Additional authentication required to complete your subscription"
      });
    }



    // Handle token packages
    if (["small", "large", "custom"].includes(packageType)) {
      // Calculate base price
      if (packageType === "small") {
        price = officialPricing.small.price;
        tokens = officialPricing.small.tokens;
      } else if (packageType === "large") {
        price = officialPricing.large.price;
        tokens = officialPricing.large.tokens;
      } else if (packageType === "custom") {
        if (price > 10) {
          return res.status(400).json({
            success: false,
            message: "Custom price cannot exceed $10."
          });
        }
        const ratio = officialPricing.custom.tokens === 0
          ? officialPricing.custom.price
          : (officialPricing.custom.price / officialPricing.custom.tokens);
        tokens = price / ratio;
      }

      if (discount && discount.for === "tokens") {
        price = price - (price * discount.value / 100);

      }

      amount = Math.round(price * 100);

      // Create PaymentIntent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        // payment_method: paymentMethodId, ❌ remove
        // confirm: true, ❌ remove
        metadata: {
          packageType,
          userId,
          price: price.toString(),
          tokens: tokens.toString(),
          discount: discountToken || "none",
        },
      });


      // Save payment record
      const paymentCount = await Payment.countDocuments();
      const uniquePaymentId = `P-${1000 + paymentCount + 1}`;
      await Payment.create({
        user: userId,
        data: packageType,
        paymentid: uniquePaymentId,
        payment: price,
        paymentIntentId: paymentIntent.id,
        tokens: tokens.toString(),
        status: "paid",
        discountCode: discountToken,
      });

      // Update discount usage
      if (discountToken) {
        const discount2 = await Discount.findOne({ token: discountToken });

        if (discount2) {
          discount2.used_by.push(userId);
          discount2.usesCount += 1;
          await discount2.save();
        }
      }


      // Update user tokens
      await User.findByIdAndUpdate(userId, {
        $inc: { tokens: tokens }
      });

      return res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        message: "Tokens purchased successfully",
      });

    }

    // Handle course purchase
    // Handle course purchase
    if (packageType === "course") {
      if (!courseId) {
        return res.status(400).json({
          success: false,
          message: "Missing course ID for course purchase."
        });
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: "Course not found."
        });
      }

      // Apply subscription discounts
      if (user.subscription === "premium") {
        price = 0;
      } else if (user.subscription === "basic") {
        price = course.price * 0.2; // 80% off
      } else {
        price = course.price; // full price
      }

      // Apply coupon discount if available and valid
      if (discount && discount.for === "tokens") {
        price = price - (price * discount.value / 100);
      }
      price = Math.round(price * 100) / 100;
      amount = Math.round(price * 100);
      tokens = 0; // No tokens for course purchases

      // Create PaymentIntent (same structure as tokens purchase)
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        metadata: {
          packageType: "course",
          userId,
          courseId,
          price: price.toString(),
          discount: discountToken || "none",
        },
      });

      // Save payment record
      const paymentCount = await Payment.countDocuments();
      const uniquePaymentId = `P-${1000 + paymentCount + 1}`;
      await Payment.create({
        user: userId,
        data: "course",
        paymentid: uniquePaymentId,
        payment: price,
        paymentIntentId: paymentIntent.id,
        tokens: "0",
        course: courseId,
        status: "paid",
        discountCode: discountToken,
      });

      // Update discount usage
      if (discountToken) {
        const discount2 = await Discount.findOne({ token: discountToken });

        if (discount2) {
          discount2.used_by.push(userId);
          discount2.usesCount += 1;
          await discount2.save();
        }
      }

      // Update user and course records
      await User.findByIdAndUpdate(userId, {
        $push: { courses: courseId }
      });
      await Course.findByIdAndUpdate(courseId, {
        $inc: { bought: 1 }
      });

      return res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        message: "Course purchased successfully",
      });
    }


    return res.status(400).json({
      success: false,
      message: "Invalid package type."
    });
  } catch (error) {
    console.error("Payment error:", error);
    return next(Boom.internal(error.message || "Payment processing failed"));
  }
};

// 2. Get All Payments with Optional Status Filter
export const getAllPaymentsWithStatus = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    // 1) Find + populate user and course
    const payments = await Payment.find(filter)
      .populate("user", "username email")    // just bring in username & email
      .populate("course", "title")           // <-- populate your course field
      .lean();                               // get plain objects

    // 2) Map in a courseTitle (or "N/A")
    const updatedPayments = payments.map((p) => ({
      ...p,
      courseTitle: p.course?.title ?? "N/A",
    }));

    return res.status(200).json({ success: true, payments: updatedPayments });
  } catch (err) {
    console.error("Error fetching payments:", err);
    return next(Boom.internal("Error fetching payments."));
  }
};


// 3. Get User-Specific Payments with Optional Status Filter
export const getUserPaymentsWithStatus = async (req, res, next) => {
  try {
    const { userId, status } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing user id." });
    }
    const query = { user: userId };
    if (status) query.status = status;
    const payments = await Payment.find(query).populate("user");
    return res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("Error fetching user payments:", error);
    return next(Boom.internal("Error fetching user payments."));
  }
};

// 4. Update Payment Status
export const updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentId, status } = req.body;
    if (!paymentId || !status) {
      return res.status(400).json({ success: false, message: "Missing required parameters." });
    }
    const payment = await Payment.findByIdAndUpdate(paymentId, { status }, { new: true });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }
    return res.status(200).json({ success: true, payment });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return next(Boom.internal("Error updating payment status."));
  }
};

// 5. Refund Payment (triggered by a refund button on the frontend)
// Updated refundPayment function with consistent subscription ID field
export const refundPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) {
      return res.status(400).json({ success: false, message: "Missing payment id." });
    }

    // 1) Load our Payment record
    const payment = await Payment.findById(paymentId).lean();
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    const {
      user: userId,
      course,
      tokens,
      data: packageType,
      paymentIntentId,
      stripeSubscriptionId,
    } = payment;

    // 2) Figure out PaymentIntent
    let intentToRefund = paymentIntentId;

    if (!intentToRefund && stripeSubscriptionId) {

      // First, try listing paid invoices (with expanded payment_intent)
      const invoices = await stripe.invoices.list({
        subscription: stripeSubscriptionId,
        limit: 1,
        status: "paid",
        expand: ["data.payment_intent"]
      });

      const lastInvoice = invoices.data[0];
      if (lastInvoice && lastInvoice.payment_intent) {
        // payment_intent may be an object (when expanded) or just an ID
        const pi = lastInvoice.payment_intent;
        intentToRefund = typeof pi === "string" ? pi : pi.id;
      } else {
        const subscription = await stripe.subscriptions.retrieve(
          stripeSubscriptionId,
          { expand: ["latest_invoice.payment_intent"] }
        );
        const li = subscription.latest_invoice;
        if (li && li.payment_intent && li.payment_intent.id) {
          intentToRefund = li.payment_intent.id;
        } else {
          return res.status(400).json({
            success: false,
            message: "Could not find any PaymentIntent to refund on that subscription."
          });
        }
      }
    }

    if (!intentToRefund) {
      return res.status(400).json({
        success: false,
        message: "No PaymentIntent found to refund."
      });
    }
    let refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: intentToRefund,
      });
    } catch (stripeErr) {
      console.error("Stripe refund error:", stripeErr);
      return res.status(500).json({ success: false, message: stripeErr.message });
    }
    if (packageType === 'course' && course) {
      await User.findByIdAndUpdate(userId, {
        $pull: {
          courses: course  // course is an ObjectId or string of course ID
        }
      });
    }

    await Payment.findByIdAndUpdate(paymentId, { status: "refunded" });

    return res.status(200).json({ success: true, refund });
  } catch (error) {
    console.error("Error processing refund:", error);
    return next(Boom.internal("Error processing refund."));
  }
};


export const cancelAnySubscription = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "Missing user id." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const { stripeSubscriptionId } = user;

    // Trial case
    if (user.trial_used && user.trail_status === "trialing") {
      await User.findByIdAndUpdate(userId, {
        $set: {
          subscription: "none",
          period: null,
          subscribed_At: null,
          nextBillingDate: null,
          trail_status: null,
          trial_used: false
        }
      });

      return res.status(200).json({
        success: true,
        message: "Trial subscription cancelled."
      });
    }

    // Paid subscription case
    if (!stripeSubscriptionId) {
      return res.status(400).json({ success: false, message: "No Stripe subscription found." });
    }

    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId);
    } catch (err) {
      if (err.code !== "resource_missing") {
        throw err;
      }
    }

    // Cancel the latest related Payment (optional, if needed)
    const payment = await Payment.findOne({ user: userId, stripeSubscriptionId }).sort({ createdAt: -1 });
    if (payment) {
      payment.status = "cancelled";
      await payment.save();
    }

    await User.findByIdAndUpdate(userId, {
      $set: {
        subscription: "none",
        period: null,
        subscribed_At: null,
        nextBillingDate: null,
        trail_status: null,
        trial_used: false,
        stripeSubscriptionId: null,
        stripeCustomerId: null
      }
    });

    return res.status(200).json({
      success: true,
      message: "Paid subscription cancelled."
    });

  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return next(Boom.internal("Error cancelling subscription."));
  }
};

// Updated cancelSubscription function for consistency
export const cancelSubscription = async (req, res, next) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) {
      return res.status(400).json({ success: false, message: "Missing payment id." });
    }

    // 1) Load our Payment record
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found." });
    }

    const {
      stripeSubscriptionId,
      user: userId,
      tokens,
    } = payment;

    if (!stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "This payment is not a subscription."
      });
    }

    // 2) Cancel on Stripe
    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId);
    } catch (err) {
      if (err.code === "resource_missing") {
        // already canceled
      } else {
        throw err;
      }
    }

    // 3) Roll back DB: remove subscription & tokens
    await User.findByIdAndUpdate(userId, {
      $set: {
        subscription: "none",          // <-- use "none" not null
        period: null,
        subscribed_At: null,
        nextBillingDate: null,
        trail_status: null,
        trial_used: true,

      },
      $inc: { tokens: -(tokens || 0) }
    });

    // 4) Mark Payment as cancelled
    payment.status = "cancelled";
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled."
    });

  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return next(Boom.internal("Error cancelling subscription."));
  }
};

export const getRevenueStats = async (req, res, next) => {
  try {
    // 1. Monthly Revenue Chart
    // Group by month and year, summing up revenue from payments with status "paid"
    const monthlyRevenue = await Payment.aggregate([
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
    const lastWeekPayments = await Payment.find({
      status: "paid",
      createdAt: { $gte: sevenDaysAgo }
    });

    // Sum up the payment amounts to get the revenue of last week
    const lastWeekRevenue = lastWeekPayments.reduce(
      (acc, payment) => acc + payment.payment,
      0
    );

    // 3. Last 7 Payments with the user object populated (only username)
    const last7Payments = await Payment.find({ status: "paid" })
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
    return next(Boom.internal("Error fetching revenue stats."));
  }
};

export const downgradeToBasic = async (req, res) => {
  try {
    const userId = req.body.userId; // or wherever you get the logged-in user's ID

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    user.downgrade = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'User marked for downgrade to basic on next cycle.'
    });

  } catch (err) {
    console.error('Downgrade error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


export default {
  createPaymentIntent,
  getAllPaymentsWithStatus,
  getUserPaymentsWithStatus,
  updatePaymentStatus,
  refundPayment,
  getRevenueStats,
  cancelSubscription,
  validateDiscountRoute,
  cancelAnySubscription,
  downgradeToBasic,
};
