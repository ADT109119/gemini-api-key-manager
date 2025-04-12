const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const logger = require('./logger');

const tokenFilePath = path.resolve(config.dataPath); // Ensure absolute path
let tokensCache = []; // In-memory cache for tokens
let currentTokenIndex = 0; // For round-robin load balancing

/**
 * Ensures the directory for the token file exists.
 */
const _ensureDataDirExists = async () => {
  const dir = path.dirname(tokenFilePath);
  try {
    await fs.access(dir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info(`Data directory '${dir}' not found. Creating...`);
      await fs.mkdir(dir, { recursive: true });
    } else {
      throw error; // Re-throw other errors
    }
  }
};

/**
 * Reads tokens from the JSON file.
 * Initializes with an empty array if the file doesn't exist or is invalid.
 * @returns {Promise<Array>} The array of token objects.
 */
const _readTokensFromFile = async () => {
  try {
    await _ensureDataDirExists(); // Ensure directory exists before reading
    const data = await fs.readFile(tokenFilePath, 'utf-8');
    const parsedTokens = JSON.parse(data);
    if (!Array.isArray(parsedTokens)) {
      logger.warn(`Invalid format in ${tokenFilePath}. Expected an array. Initializing with empty array.`);
      return [];
    }
    // Basic validation for token structure could be added here
    return parsedTokens;
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info(`${tokenFilePath} not found. Initializing with empty array.`);
      return []; // File doesn't exist, start fresh
    } else if (error instanceof SyntaxError) {
      logger.error(`Error parsing JSON in ${tokenFilePath}: ${error.message}. Initializing with empty array.`);
      return []; // Invalid JSON
    } else {
      logger.error(`Error reading token file ${tokenFilePath}:`, error);
      throw error; // Re-throw unexpected errors
    }
  }
};

/**
 * Writes the current token cache to the JSON file.
 * @param {Array} tokens The array of tokens to write.
 * @returns {Promise<void>}
 */
const _writeTokensToFile = async (tokens) => {
  try {
    await _ensureDataDirExists(); // Ensure directory exists before writing
    const data = JSON.stringify(tokens, null, 2); // Pretty print JSON
    await fs.writeFile(tokenFilePath, data, 'utf-8');
    logger.debug(`Tokens successfully written to ${tokenFilePath}`);
  } catch (error) {
    logger.error(`Error writing token file ${tokenFilePath}:`, error);
    throw error;
  }
};

/**
 * Initializes the token store by reading from the file.
 * Should be called on application startup.
 * @returns {Promise<void>}
 */
const initializeStore = async () => {
  logger.info(`Initializing token store from ${tokenFilePath}...`);
  try {
    tokensCache = await _readTokensFromFile();
    // Initialize status if missing
    tokensCache.forEach(token => {
      if (token.status === undefined) token.status = 'unknown';
      if (token.lastChecked === undefined) token.lastChecked = null;
      if (token.isValid === undefined) token.isValid = null; // null = unknown, true = valid, false = invalid
    });
    await _writeTokensToFile(tokensCache); // Save potentially updated statuses
    logger.info(`Token store initialized. Loaded ${tokensCache.length} tokens.`);
    currentTokenIndex = 0; // Reset index on load
  } catch (error) {
    logger.error('Failed to initialize token store:', error);
    // Depending on the error, might want to exit or run with empty cache
    tokensCache = [];
  }
};

/**
 * Gets all tokens from the cache.
 * @returns {Array} A copy of the tokens array.
 */
const getAllTokens = () => {
  // Return a deep copy to prevent accidental modification of the cache
  return JSON.parse(JSON.stringify(tokensCache));
};

/**
 * Adds a new token to the store.
 * @param {object} tokenData - The token data (e.g., { key: '...', name: '...', type: 'google'/'openai' }).
 * @returns {Promise<object>} The added token object with an assigned ID.
 */
const addToken = async (tokenData) => {
  if (!tokenData || !tokenData.key || !tokenData.type) {
    throw new Error('Invalid token data. Requires at least "key" and "type".');
  }
  const newId = Date.now().toString(); // Simple unique ID
  const newToken = {
    id: newId,
    name: tokenData.name || `Token ${newId}`, // Default name
    key: tokenData.key,
    type: tokenData.type, // 'google' or 'openai'
    status: 'unknown', // e.g., 'valid', 'invalid', 'unknown', 'rate_limited'
    isValid: null,
    lastChecked: null,
    lastUsed: null,
    // Add other relevant fields like usage count, rate limit info etc. later
  };
  tokensCache.push(newToken);
  await _writeTokensToFile(tokensCache);
  logger.info(`Added token: ${newToken.name} (ID: ${newToken.id})`);
  return JSON.parse(JSON.stringify(newToken)); // Return a copy
};

/**
 * Updates an existing token.
 * @param {string} id - The ID of the token to update.
 * @param {object} updates - An object containing the fields to update.
 * @returns {Promise<object|null>} The updated token object or null if not found.
 */
const updateToken = async (id, updates) => {
  const index = tokensCache.findIndex(token => token.id === id);
  if (index === -1) {
    logger.warn(`Token with ID ${id} not found for update.`);
    return null;
  }
  // Only update allowed fields, prevent changing ID or key directly here?
  const allowedUpdates = { ...updates };
  delete allowedUpdates.id; // Cannot change ID
  // delete allowedUpdates.key; // Maybe allow key update? For now, yes.

  tokensCache[index] = { ...tokensCache[index], ...allowedUpdates };
  await _writeTokensToFile(tokensCache);
  logger.info(`Updated token ID: ${id}`);
  return JSON.parse(JSON.stringify(tokensCache[index])); // Return a copy
};

/**
 * Deletes a token from the store.
 * @param {string} id - The ID of the token to delete.
 * @returns {Promise<boolean>} True if deleted, false if not found.
 */
const deleteToken = async (id) => {
  const initialLength = tokensCache.length;
  tokensCache = tokensCache.filter(token => token.id !== id);
  if (tokensCache.length < initialLength) {
    await _writeTokensToFile(tokensCache);
    logger.info(`Deleted token ID: ${id}`);
    return true;
  }
  logger.warn(`Token with ID ${id} not found for deletion.`);
  return false;
};

/**
 * Gets a token by its ID.
 * @param {string} id - The ID of the token.
 * @returns {object|null} The token object or null if not found.
 */
const getTokenById = (id) => {
  const token = tokensCache.find(t => t.id === id);
  return token ? JSON.parse(JSON.stringify(token)) : null; // Return a copy
};

/**
 * Gets the next available token based on round-robin strategy,
 * skipping tokens marked as invalid (isValid === false).
 * @param {string} type - 'google' or 'openai' to filter by type.
 * @returns {object|null} The next available token object or null if none are available/valid.
 */
const getNextAvailableToken = (type) => {
  const availableTokens = tokensCache.filter(t => t.type === type && t.isValid !== false);

  if (availableTokens.length === 0) {
    logger.warn(`No valid tokens of type '${type}' available.`);
    return null;
  }

  // Simple round-robin for now
  currentTokenIndex = (currentTokenIndex + 1) % availableTokens.length;
  const selectedToken = availableTokens[currentTokenIndex];

  // Update lastUsed timestamp (don't wait for write)
  updateToken(selectedToken.id, { lastUsed: new Date().toISOString() }).catch(err => {
      logger.error(`Failed to update lastUsed for token ${selectedToken.id}:`, err);
  });


  logger.debug(`Selected token ID ${selectedToken.id} (Index: ${currentTokenIndex}) for type '${type}'`);
  return JSON.parse(JSON.stringify(selectedToken)); // Return a copy
};


module.exports = {
  initializeStore,
  getAllTokens,
  addToken,
  updateToken,
  deleteToken,
  getTokenById,
  getNextAvailableToken,
};
