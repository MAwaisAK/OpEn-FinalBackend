"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
const router = _express2.default.Router();
const { updateSaleStatusCron } = require('../middlewares/cronjobs'); // Import the cron job function

// Endpoint to manually trigger the cron job
router.get('/run-cron', async (req, res) => {
  try {
    await updateSaleStatusCron();  // Trigger the cron job function
    res.json({ message: 'Cron job triggered successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error triggering cron job.', error });
  }
});

module.exports = router;