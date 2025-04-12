const express = require('express');
const cors = require('cors');
const path = require('path'); // Needed for serving static files
const config = require('./config');
const logger = require('./logger');
const tokenStore = require('./tokenStore');
// API and Proxy routers will be imported later
const apiRouter = require('./api'); // Import the API router
const proxyRouter = require('./proxy'); // Import the Proxy router

const app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '5000mb'}));
app.use(bodyParser.urlencoded({limit: '5000mb', extended: true}));

// --- Middleware ---
// Enable CORS for all origins (adjust in production if needed)
app.use(cors());
// Parse JSON request bodies
app.use(express.json());
// Basic request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// --- Static Files (Admin UI) ---
// Serve static files from the 'public' directory
const publicPath = path.join(__dirname, '..', 'public'); // Go up one level from src
app.use(express.static(publicPath));
logger.info(`Serving static files from: ${publicPath}`);

// --- API Routes ---
// Mount the API router
app.use('/api', apiRouter);
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// --- Proxy Routes ---
// Mount the proxy router
app.use('/proxy', proxyRouter);

// --- Root Route (Serve Admin UI) ---
// Redirect root to index.html or handle directly
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});


// --- Error Handling ---
// Basic 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Not Found' });
});

// General error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// --- Start Server ---
const startServer = async () => {
  try {
    // Initialize the token store before starting the server
    await tokenStore.initializeStore();

    app.listen(config.port, () => {
      logger.info(`Server listening on port ${config.port}`);
      logger.info(`Admin UI accessible at http://localhost:${config.port}`);
      logger.info(`API health check at http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1); // Exit if server fails to start
  }
};

// Start the server
startServer();

module.exports = app; // Export for potential testing
