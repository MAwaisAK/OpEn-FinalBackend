"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// jobs/subscriptionCron.js
var _nodecron = require('node-cron'); var _nodecron2 = _interopRequireDefault(_nodecron);
var _momenttimezone = require('moment-timezone'); var _momenttimezone2 = _interopRequireDefault(_momenttimezone);
var _userjs = require('../models/user.js'); var _userjs2 = _interopRequireDefault(_userjs); // Adjust path if needed
var _notificationsjs = require('../models/notifications.js'); var _notificationsjs2 = _interopRequireDefault(_notificationsjs);
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);

const downloadsRoot = _path2.default.join(process.cwd(), "public", "downloads");

function deleteOldFiles(dir, maxAgeMinutes = 15) {
  _fs2.default.readdir(dir, (err, subdirs) => {
    if (err) return;

    subdirs.forEach(sub => {
      const subPath = _path2.default.join(dir, sub);
      _fs2.default.readdir(subPath, (_, files) => {
        files.forEach(file => {
          const filePath = _path2.default.join(subPath, file);
          _fs2.default.stat(filePath, (_, stats) => {
            const ageMs = Date.now() - stats.mtimeMs;
            if (ageMs > maxAgeMinutes * 60 * 1000) {
              _fs2.default.unlink(filePath, () => console.log("🧹 Deleted:", filePath));
            }
          });
        });
      });
    });
  });
}


// Runs every day at midnight Canadian Central Time
_nodecron2.default.schedule('0 0 * * *', async () => {
  const now = _momenttimezone2.default.call(void 0, ).tz('America/Toronto'); // Canada Eastern Time Zone

  try {
    const users = await _userjs2.default.find({
      subscription: { $ne: 'none' } // only those with a trial or real sub
    });

    for (const user of users) {
      if (!user.subscribed_At) continue;

      const subscribedDate = _momenttimezone2.default.call(void 0, user.subscribed_At);
      const diffDays = now.diff(subscribedDate, 'days');

      let shouldDeactivate = false;
      let totalDuration = 0;

      if (user.subscription === 'trial') {
        totalDuration = 7;
        shouldDeactivate = diffDays >= 7;
      } else if (user.period === 'month') {
        totalDuration = 30;
        shouldDeactivate = diffDays >= 30;
      } else if (user.period === 'year') {
        totalDuration = 365;
        shouldDeactivate = diffDays >= 365;
      }

      const remainingDays = totalDuration - diffDays;

      // 🔔 Notify 7 days before expiration
      if (remainingDays === 7) {
        const notificationText = `Your ${user.subscription} subscription will expire in 7 days.`;
        await _notificationsjs2.default.updateOne(
          { user: user._id },
          { $addToSet: { type: "7days", data: notificationText } },
          { upsert: true }
        );
      }

      if (shouldDeactivate) {
        user.subscription = 'none';
        user.trial_used = true;
        await user.save();

        // 🔔 Notify user about subscription end
        const notificationText = `Your subscription has ended. Please renew to continue accessing premium features.`;
        await _notificationsjs2.default.updateOne(
          { user: user._id },
          { $addToSet: { type: "over", data: notificationText } },
          { upsert: true }
        );
      }
    }

    deleteOldFiles(downloadsRoot);
  } catch (err) {
    console.error('Error running subscription cron:', err);
  }
});

