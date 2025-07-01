"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// controllers/news.js
var _newsjs = require('../../models/news.js'); var _newsjs2 = _interopRequireDefault(_newsjs);     // adjust path as needed
var _boom = require('boom'); var _boom2 = _interopRequireDefault(_boom);
var _nodefetch = require('node-fetch'); var _nodefetch2 = _interopRequireDefault(_nodefetch);             // or omit on Node 18+

// GET /news – retrieve all news documents
 const getAllNews = async (req, res, next) => {
  try {
    const newsList = await _newsjs2.default.find();
    res.json({ news: newsList });
  } catch (err) {
    next(err);
  }
}; exports.getAllNews = getAllNews;

// PUT /news/:newsId/replace – swap in a random business article at one index
 const replaceNewsSection = async (req, res, next) => {
  const { newsId } = req.params;
  const idx = parseInt(req.body.index, 10);

  // validation
  if (isNaN(idx) || idx < 0) {
    return next(_boom2.default.badRequest("Invalid section index"));
  }

  try {
    const doc = await _newsjs2.default.findById(newsId);
    if (!doc) {
      return next(_boom2.default.notFound("News document not found"));
    }

    // fetch up to 10 business articles
    const API_KEY = process.env.GNEWS_API_KEY;
    const url = `https://gnews.io/api/v4/top-headlines?topic=business&lang=en&token=${API_KEY}&max=10`;
    const response = await _nodefetch2.default.call(void 0, url);
    const data = await response.json();

    if (!_optionalChain([data, 'access', _ => _.articles, 'optionalAccess', _2 => _2.length])) {
      return next(_boom2.default.badGateway("No articles returned from GNews"));
    }

    // bound‐check all four arrays
    const maxSections = Math.max(
      _optionalChain([doc, 'access', _3 => _3.img, 'optionalAccess', _4 => _4.length]) || 0,
      _optionalChain([doc, 'access', _5 => _5.title, 'optionalAccess', _6 => _6.length]) || 0,
      _optionalChain([doc, 'access', _7 => _7.content, 'optionalAccess', _8 => _8.length]) || 0,
      _optionalChain([doc, 'access', _9 => _9.link, 'optionalAccess', _10 => _10.length]) || 0
    );
    if (idx >= maxSections) {
      return next(_boom2.default.badRequest("Section index out of bounds"));
    }

    // only pick articles whose URL isn’t already in this doc
    const existing = doc.link || [];
    const unique = data.articles.filter(a => a.url && !existing.includes(a.url));
    if (unique.length === 0) {
      return next(_boom2.default.badGateway("No unique business articles available"));
    }

    // random pick
    const rand = unique[Math.floor(Math.random() * unique.length)];

    // overwrite at idx
    doc.img[idx]     = rand.image       || "";
    doc.title[idx]   = rand.title       || "";
    doc.content[idx] = rand.description || "";
    doc.link[idx]    = rand.url         || "";

    await doc.save();
    res.json({ message: "Section replaced", news: doc });
  } catch (err) {
    next(err);
  }
}; exports.replaceNewsSection = replaceNewsSection;

exports. default = { getAllNews: exports.getAllNews, replaceNewsSection: exports.replaceNewsSection };
