"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// jobs/newsCron.js
var _nodecron = require('node-cron'); var _nodecron2 = _interopRequireDefault(_nodecron);
var _momenttimezone = require('moment-timezone'); var _momenttimezone2 = _interopRequireDefault(_momenttimezone);
var _nodefetch = require('node-fetch'); var _nodefetch2 = _interopRequireDefault(_nodefetch);      // or omit on Node 18+
var _newsjs = require('../models/news.js'); var _newsjs2 = _interopRequireDefault(_newsjs); // adjust path as needed

// every day at midnight ET (Canada)
_nodecron2.default.schedule(
  "0 0 * * *",
  async () => {
    const now = _momenttimezone2.default.call(void 0, ).tz("America/Toronto");

    try {
      const API_KEY = process.env.GNEWS_API_KEY;
      const url = `https://gnews.io/api/v4/top-headlines?country=ca&lang=en&token=${API_KEY}&max=5`;
      const res = await _nodefetch2.default.call(void 0, url);
      const data = await res.json();

      if (!_optionalChain([data, 'access', _ => _.articles, 'optionalAccess', _2 => _2.length])) {
        console.warn("⚠️ No articles from GNews for Canada");
        return;
      }

      const top5 = data.articles.slice(0, 5);
      const img     = top5.map(a => a.image       || "");
      const title   = top5.map(a => a.title       || "");
      const content = top5.map(a => a.description || "");
      const link    = top5.map(a => a.url         || "");

      // find the very first doc, or create if none:
      let doc = await _newsjs2.default.findOne().sort({ createdAt: 1 });
      if (doc) {
        doc.img     = img;
        doc.title   = title;
        doc.content = content;
        doc.link    = link;
        await doc.save();
      } else {
        doc = new (0, _newsjs2.default)({ img, title, content, link });
        await doc.save();
      }
    } catch (err) {
      console.error("❌ Error in newsCron:", err);
    }
  },
  { timezone: "America/Toronto" }
);
