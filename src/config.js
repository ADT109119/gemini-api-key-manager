// Load environment variables from .env file
require('dotenv').config();

const config = {
  // Server configuration
  port: process.env.PORT || 3000, // Default port is 3000

  // Data persistence configuration
  dataPath: process.env.DATA_PATH || './data/tokens.json', // Default path for token storage

  // Logging configuration
  logLevel: process.env.LOG_LEVEL || 'info', // Default log level

  // Proxy target APIs (can be overridden by env vars if needed)
  googleApiEndpoint: process.env.GOOGLE_API_ENDPOINT || 'https://generativelanguage.googleapis.com',
  openaiApiEndpoint: process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com',

  // Add other configurations as needed
};

module.exports = config;
