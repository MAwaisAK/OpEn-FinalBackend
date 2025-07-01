"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _jwtjs = require('../helpers/jwt.js'); // Optional, if you want to secure the routes
var _payment = require('../controllers/payment'); var _payment2 = _interopRequireDefault(_payment);

const router = _express2.default.Router();

// Create Payment Intent (public or secure as needed)
// router.post("/create-payment-intent", verifyAccessToken, payment.createPaymentIntent);
router.post("/create-payment-intent", _payment2.default.createPaymentIntent);

// Get all payments with an optional status filter
// e.g., GET /api/payments/all-payments?status=pending
router.get("/all-payments", _payment2.default.getAllPaymentsWithStatus);

// Get payments for a specific user with an optional status filter
// e.g., GET /api/payments/user-payments?userId=123&status=completed
router.get("/user-payments", _payment2.default.getUserPaymentsWithStatus);

// Update the status of a payment record
// e.g., PUT /api/payments/update-payment-status with JSON body { paymentId: "xxx", status: "completed" }
router.put("/update-payment-status", _payment2.default.updatePaymentStatus);

// Refund a payment
// e.g., POST /api/payments/refund-payment with JSON body { paymentId: "xxx" }
router.post("/refund-payment", _payment2.default.refundPayment);

router.get("/revenue-stats", _payment2.default.getRevenueStats);

exports. default = router;
