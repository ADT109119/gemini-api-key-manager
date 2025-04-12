const express = require('express');
const tokenStore = require('./tokenStore');
const logger = require('./logger');
const fetch = require('node-fetch'); // Needed for test endpoint
const config = require('./config'); // Needed for test endpoint

const router = express.Router();

// --- Token CRUD Operations ---

// GET /api/keys - Get all tokens
router.get('/keys', (req, res) => {
  try {
    const tokens = tokenStore.getAllTokens();
    res.status(200).json(tokens);
  } catch (error) {
    logger.error('Error getting all tokens:', error);
    res.status(500).json({ error: 'Failed to retrieve tokens' });
  }
});

// POST /api/keys - Add a new token
router.post('/keys', async (req, res) => {
  const { key, type, name } = req.body;
  if (!key || !type) {
    return res.status(400).json({ error: 'Missing required fields: key and type' });
  }
  if (type !== 'google' && type !== 'openai') {
      return res.status(400).json({ error: 'Invalid type: must be "google" or "openai"' });
  }

  try {
    const newTokenData = { key, type, name };
    const addedToken = await tokenStore.addToken(newTokenData);
    res.status(201).json(addedToken);
  } catch (error) {
    logger.error('Error adding token:', error);
    res.status(500).json({ error: 'Failed to add token', message: error.message });
  }
});

// GET /api/keys/:id - Get a specific token by ID
router.get('/keys/:id', (req, res) => {
  const { id } = req.params;
  try {
    const token = tokenStore.getTokenById(id);
    if (token) {
      res.status(200).json(token);
    } else {
      res.status(404).json({ error: `Token with ID ${id} not found` });
    }
  } catch (error) {
    logger.error(`Error getting token ${id}:`, error);
    res.status(500).json({ error: 'Failed to retrieve token' });
  }
});

// PUT /api/keys/:id - Update a token by ID
router.put('/keys/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Basic validation: prevent updating ID or potentially sensitive fields if needed
  delete updates.id; // Cannot change ID via PUT

  if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No update fields provided' });
  }
  // Validate type if provided
  if (updates.type && updates.type !== 'google' && updates.type !== 'openai') {
      return res.status(400).json({ error: 'Invalid type: must be "google" or "openai"' });
  }


  try {
    const updatedToken = await tokenStore.updateToken(id, updates);
    if (updatedToken) {
      res.status(200).json(updatedToken);
    } else {
      res.status(404).json({ error: `Token with ID ${id} not found` });
    }
  } catch (error) {
    logger.error(`Error updating token ${id}:`, error);
    res.status(500).json({ error: 'Failed to update token', message: error.message });
  }
});

// DELETE /api/keys/:id - Delete a token by ID
router.delete('/keys/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await tokenStore.deleteToken(id);
    if (deleted) {
      res.status(204).send(); // No content on successful deletion
    } else {
      res.status(404).json({ error: `Token with ID ${id} not found` });
    }
  } catch (error) {
    logger.error(`Error deleting token ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

// --- Batch Operations (To be implemented later) ---
// POST /api/keys/batch/add
// POST /api/keys/batch/delete
// POST /api/keys/batch/check
// GET /api/keys/batch/export?ids=...

// --- Status Check (To be implemented later) ---
// POST /api/keys/:id/check

// --- Proxy Test Tool Endpoint ---
router.post('/test-proxy', async (req, res) => {
    const { type, tokenId } = req.body; // type: 'google' or 'openai', tokenId is optional

    if (!type || (type !== 'google' && type !== 'openai')) {
        return res.status(400).json({ error: 'Invalid or missing "type" parameter. Must be "google" or "openai".' });
    }

    let token;
    if (tokenId) {
        token = tokenStore.getTokenById(tokenId);
        if (!token) {
            return res.status(404).json({ error: `Token with ID ${tokenId} not found.` });
        }
        if (token.type !== type) {
             return res.status(400).json({ error: `Token ${tokenId} is of type ${token.type}, but requested test type is ${type}.` });
        }
    } else {
        token = tokenStore.getNextAvailableToken(type); // Get next available if no specific ID given
    }

    if (!token) {
        return res.status(503).json({ error: `No available or valid tokens found for type "${type}".` });
    }

    logger.info(`Testing proxy for type '${type}' using token ID: ${token.id} (${token.name})`);

    let testUrl = '';
    let fetchOptions = {
        method: 'GET', // Default to GET for simple tests
        headers: {
            'Authorization': `Bearer ${token.key}`,
            'Accept': 'application/json',
        },
        timeout: 10000, // 10 second timeout
    };

    // Define simple, low-cost test requests for each API
    if (type === 'google') {
        // Example: Get info about a specific model (less likely to change than listing all)
        // Using v1beta as v1 doesn't have a simple GET models endpoint without API key in path
        testUrl = `${config.googleApiEndpoint}/v1beta/openai/models`;
    } else if (type === 'openai') {
        // Example: List models (a common, simple GET request)
        testUrl = `${config.openaiApiEndpoint}/v1/models`;
    }

    try {
        const startTime = Date.now();
        const response = await fetch(testUrl, fetchOptions);
        const duration = Date.now() - startTime;
        const responseBody = await response.text(); // Read as text to handle potential non-JSON errors

        let resultData = {
            tokenId: token.id,
            tokenName: token.name,
            type: type,
            testUrl: testUrl,
            status: response.status,
            durationMs: duration,
            success: response.ok,
            responseSnippet: responseBody.substring(0, 200) + (responseBody.length > 200 ? '...' : ''), // Include snippet
        };

        // Update token status in store
        const newStatus = response.ok ? 'valid' : `error_${response.status}`;
        const isValid = response.ok;
        await tokenStore.updateToken(token.id, {
            status: newStatus,
            isValid: isValid,
            lastChecked: new Date().toISOString()
        });
        logger.info(`Proxy test for token ${token.id} completed. Status: ${response.status}, Valid: ${isValid}`);

        res.status(200).json(resultData);

    } catch (error) {
        const duration = Date.now() - (startTime || Date.now()); // Calculate duration even on error
        logger.error(`Proxy test failed for token ${token.id}:`, error);

        // Update token status as invalid due to network or other error
         await tokenStore.updateToken(token.id, {
            status: 'error_network', // Or more specific error
            isValid: false,
            lastChecked: new Date().toISOString()
        });

        res.status(500).json({
            tokenId: token.id,
            tokenName: token.name,
            type: type,
            testUrl: testUrl,
            success: false,
            durationMs: duration,
            error: 'Proxy test request failed',
            details: error.message,
        });
    }
});


module.exports = router;
