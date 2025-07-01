"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _multer = require('multer'); var _multer2 = _interopRequireDefault(_multer);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);

const router = _express2.default.Router();

var _product = require('../controllers/product'); var _product2 = _interopRequireDefault(_product);
var _grantAccess = require('../middlewares/grantAccess'); var _grantAccess2 = _interopRequireDefault(_grantAccess);
var _jwt = require('../helpers/jwt');

// Set up Multer storage configuration
const storage = _multer2.default.memoryStorage(); // Use memory storage instead

const upload = _multer2.default.call(void 0, { storage: storage });


// Middleware to handle different types of uploads
const handleUploads = upload.fields([
  { name: 'displayPhoto'},
  { name: 'frontPhoto' },
  { name: 'backPhoto' },
  { name: 'productPhotos'},
  { name: 'colorPhotos'},
  { name: 'frontdisplayPhoto'},
  { name: 'backdisplayPhoto'},
]);

const editUploads = upload.fields([
  { name: 'displayPhoto'},
  { name: 'frontPhoto' },
  { name: 'backPhoto' },
  { name: 'productPhotos'},
  { name: 'colorPhotos'},
  { name: 'frontdisplayPhoto'},
  { name: 'backdisplayPhoto'},
]);


// Endpoint to create a product with image uploads
router.post(
  "/",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "createAny", "product"),
  handleUploads,
  _product2.default.Create  // Controller to handle the product creation logic
);
router.post(
  "/update-sale",
  _jwt.verifyAccessToken,                // Middleware to verify the access token
  _grantAccess2.default.call(void 0, "updateAny", "product"), // Middleware to check permissions
  _product2.default.updateSale                // Call the updateSale method from the Product controller
);
router.post(
  "/update-saleunits",
  _jwt.verifyAccessToken,                // Middleware to verify the access token
  _grantAccess2.default.call(void 0, "updateAny", "product"), // Middleware to check permissions
  _product2.default.setUnits                // Call the updateSale method from the Product controller
);
router.post(
  "/update-status",
  _jwt.verifyAccessToken,                // Middleware to verify the access token
  _grantAccess2.default.call(void 0, "updateAny", "product"), // Middleware to check permissions
  _product2.default.ActiveStatus                // Call the updateSale method from the Product controller
);

router.post(
  "/fetch-products-by-ids", // Add your new endpoint here
  _jwt.verifyAccessToken,         // Middleware to verify the access token
  _product2.default.fetchProductsByIds // Use the fetchProductsByIds controller function
);

router.get("/", _product2.default.GetList);
router.get("/completelist", _product2.default.GetCompleteList);
router.get("/bynew", _product2.default.fetchProductsByNew);
router.get("/bysold", _product2.default.fetchTopProductsBySold);
router.get("/daysale", _product2.default.fetchProductsByDaySale);
router.get("/menproducts", _product2.default.fetchProductsByMen);
router.get("/womenproducts", _product2.default.fetchProductsByWomen);
router.get("/totalcount", _product2.default.GetTotalCount);
router.get(
  "/:product_id",
  _product2.default.Get
);

router.put(
  "/:product_id",
  _jwt.verifyAccessToken,
  _grantAccess2.default.call(void 0, "updateAny", "product"),
  editUploads,  // Include this middleware to handle file uploads
  _product2.default.Update  // Call the Update method from the Product controller
);

router.delete("/:product_id", _product2.default.Delete);

exports. default = router;
