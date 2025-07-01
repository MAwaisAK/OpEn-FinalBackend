"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// src/index.js
require('dotenv/config');
require('./clients/db');
var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _boom = require('boom'); var _boom2 = _interopRequireDefault(_boom);
var _cors = require('cors'); var _cors2 = _interopRequireDefault(_cors);
var _ratelimiter = require('./rate-limiter'); var _ratelimiter2 = _interopRequireDefault(_ratelimiter);
var _routes = require('./routes'); var _routes2 = _interopRequireDefault(_routes);
var _mongoose = require('mongoose'); var _mongoose2 = _interopRequireDefault(_mongoose);
require('./utils/subs.js'); // Ensure correct path
require('./utils/news.js'); // Ensure correct path
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _http = require('http');
var _socketio = require('socket.io');
var _indexjs = require('./socketHandlers/index.js');
var _audioHandlersjs = require('./socketHandlers/audioHandlers.js');
var _users = require('./utils/users');

const app = _express2.default.call(void 0, );
const httpServer = _http.createServer.call(void 0, app);

const io = new (0, _socketio.Server)(httpServer, {
  cors: {
    origin: ['https://opulententrepreneurs.business','https://www.opulententrepreneurs.business','http://localhost:3000'], // Allowed domain
    methods: ["GET", "POST"]
  }
});

// Register socket handlers on connection
io.on('connection', (socket) => {
  console.log('New user connected');
  _indexjs.registerSocketHandlers.call(void 0, socket, io);
  _audioHandlersjs.registerAudioCallHandlers.call(void 0, socket, io, _users.user);

  socket.on('disconnect', () => {
    console.log('User disconnected');
    if (_users.user) {
      io.to(_users.user.room).emit('updateUserList', _users.user.getUserList(_users.user.room));
    }// Optionally, handle user removal from the Users instance here if needed.
  });
});

// Middleware
// Make sure this is before any of your routes, including /proxy-download:
app.use(_cors2.default.call(void 0, {
  origin: ['https://opulententrepreneurs.business',
           'https://www.opulententrepreneurs.business',
           'http://localhost:3000'],
           methods: ["GET", "POST", "PUT", "OPTIONS"],// include OPTIONS
  allowedHeaders: ["Origin","X-Requested-With",
                   "Content-Type","Accept","Authorization"]
}));

// Then your proxy-download route, untouched by manual CORS headers:
app.get('/proxy-download', async (req, res, next) => {
  const { fileUrl } = req.query;
  if (!fileUrl) {
    return res.status(400).json({ error: "Missing fileUrl query parameter" });
  }
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch file" });
    }
    // copy content-type from upstream
    res.setHeader('Content-Type',
                  response.headers.get('content-type') || 'application/octet-stream');

    // stream it down
    const nodeStream = _stream.Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } catch (error) {
    next(error);
  }
});


app.use(
  "/downloads",
  _express2.default.static(_path2.default.join(process.cwd(), "public", "downloads"))
);


app.use(_ratelimiter2.default);
app.use(_express2.default.json());
app.use(_express2.default.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', _express2.default.static(_path2.default.join(process.cwd(), './uploads')));

var _stream = require('stream');

app.get('/proxy-download', async (req, res, next) => {
  const { fileUrl } = req.query;
  if (!fileUrl) {
    return res.status(400).json({ error: "Missing fileUrl query parameter" });
  }
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch file" });
    }
    // copy content-type from upstream
    res.setHeader('Content-Type',
                  response.headers.get('content-type') || 'application/octet-stream');

    // stream it down
    const nodeStream = _stream.Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } catch (error) {
    next(error);
  }
});
// API Routes
app.use(_routes2.default);

// Custom 404 Middleware
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/socket.io/')) {
    return next(); // Let Socket.io handle its own requests
  }
  return next(_boom2.default.notFound(`The requested route '${req.originalUrl}' does not exist.`));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err);
  if (err.isBoom) {
    return res.status(err.output.statusCode).json(err.output.payload);
  }
  return res.status(500).json({ error: 'Internal Server Error' });
});

// MongoDB Connection with Retry Logic
const mongoURI = process.env.MONGO_URI;
let retries = 0;
const maxRetries = 5;
const retryDelay = 10000; // 10 seconds

const connectWithRetry = () => {
  _mongoose2.default.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => {
      console.error('MongoDB connection failed:', err);
      if (retries < maxRetries) {
        retries += 1;
        console.log(`Retrying MongoDB connection... Attempt ${retries}/${maxRetries}`);
        setTimeout(connectWithRetry, retryDelay);
      } else {
        console.error('Max retries reached. Running without database connection.');
      }
    });
};

httpServer.listen(4000, () => console.log('Server is running on port 4000'));

// Attempt initial MongoDB connection
connectWithRetry();
