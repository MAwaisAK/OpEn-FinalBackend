"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
const router = _express2.default.Router();

var _order = require('../controllers/order'); var _order2 = _interopRequireDefault(_order);

router.post('/', _order2.default.Create);
router.get('/', _order2.default.List);
router.get('/my-orders', _order2.default.GetMyOrders);
router.put('/update-status', _order2.default.UpdateStatus);
router.get('/total-orders/:rangeType', _order2.default.GetTotalOrdersByDateRange);
router.get('/total-order-count/:rangeType', _order2.default.GetTotalNumberOfOrdersByDateRange);
router.get('/total-order-category/:rangeType', _order2.default.GetTotalSoldByCategory);
router.get('/total-order-gender/:rangeType', _order2.default.GetTotalSoldByGender);
router.get('/total-orders-by-month/:year', _order2.default.GetTotalOrdersByMonth);


exports. default = router;
