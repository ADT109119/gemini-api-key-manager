const express = require('express');
const fetch = require('node-fetch'); // Using node-fetch v2 syntax (require)
const tokenStore = require('./tokenStore');
const logger = require('./logger');
const config = require('./config');

const router = express.Router();

// Helper to handle streaming responses (Server-Sent Events)
const handleStreamingResponse = async (targetResponse, clientResponse) => {
    clientResponse.writeHead(targetResponse.status, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        // Copy other relevant headers from targetResponse if needed
        'Access-Control-Allow-Origin': '*', // Adjust CORS if necessary
    });

    try {
        for await (const chunk of targetResponse.body) {
            clientResponse.write(chunk);
        }
    } catch (error) {
        logger.error('Error streaming response:', error);
        // Don't try to write headers again if they were already sent
        if (!clientResponse.headersSent) {
             clientResponse.writeHead(500, { 'Content-Type': 'application/json' });
        }
        clientResponse.end(JSON.stringify({ error: 'Error streaming response from target API' }));
    } finally {
        if (!clientResponse.writableEnded) {
            clientResponse.end();
        }
    }
};

// Generic proxy handler
const proxyRequest = async (req, res, type) => {
    const targetApiBase = type === 'google' ? config.googleApiEndpoint : config.openaiApiEndpoint;
    // When using router.use('/google', ...), req.url contains the path *after* /google + query string
    const subPathAndQuery = req.url;

    // 1. Get an available token
    const token = tokenStore.getNextAvailableToken(type);
    if (!token) {
        logger.error(`Proxy Error: No available '${type}' tokens.`);
        return res.status(503).json({ error: `No available ${type} API keys configured or valid.` });
    }
    logger.info(`Proxying to ${type} using token ID: ${token.id} (${token.name})`);

    // 2. Construct Target URL & Prepare Auth
    let targetUrl = `${targetApiBase}${subPathAndQuery}`;
    const headers = { ...req.headers }; // Start with client headers

    if (type === 'google') {
        // Google GenAI API uses 'key' query parameter
        // const urlSeparator = targetUrl.includes('?') ? '&' : '?';
        // targetUrl += `${urlSeparator}key=${token.key}`;
        // Remove potential Authorization header if client sent one
        // delete headers.authorization;
        headers['Authorization'] = `Bearer ${token.key}`;

    } else if (type === 'openai') {
        // OpenAI API uses Authorization Bearer token header
        headers['Authorization'] = `Bearer ${token.key}`;
    }

    logger.debug(`Target URL: ${targetUrl}`);


    // 3. Prepare Headers (Common adjustments)
    // Use the 'headers' variable declared earlier
    // Remove headers specific to this proxy or that might interfere
    delete headers.host;
    delete headers.connection;
    // Ensure content-type is passed correctly (already copied if present)
    if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'];
    }
     // Add accept header if client sent one, default to application/json
    headers['Accept'] = req.headers['accept'] || 'application/json';


    logger.debug(`Forwarding headers:`, JSON.stringify(headers).substring(0, 200) + '...'); // Log snippet

    // 4. Forward Request
    try {
        const fetchOptions = {
            method: req.method,
            headers: headers,
            body: (req.method !== 'GET' && req.method !== 'HEAD') ? JSON.stringify(req.body) : undefined,
            // Add timeout? redirect handling?
        };

        logger.info(`Proxying ${req.method} ${subPathAndQuery} to ${targetUrl}`); // Log subPathAndQuery
        const targetResponse = await fetch(targetUrl, fetchOptions);
        logger.info(`Received ${targetResponse.status} from ${targetUrl}`);

        // 5. Handle Response (Standard vs Streaming)
        const contentType = targetResponse.headers.get('content-type');
        const isStreaming = contentType && contentType.includes('text/event-stream');

        // Update token status based on response (basic example)
        if (targetResponse.status === 401 || targetResponse.status === 403 || targetResponse.status === 429) {
             logger.warn(`Token ID ${token.id} (${token.name}) returned ${targetResponse.status}. Marking as potentially invalid/rate-limited.`);
             // Mark as invalid for now, could add more granular status later (e.g., 'rate_limited')
             await tokenStore.updateToken(token.id, { isValid: false, status: `error_${targetResponse.status}`, lastChecked: new Date().toISOString() });
        } else if (targetResponse.ok && token.isValid === false) {
             // If it was marked invalid but now works, mark it as valid again
             logger.info(`Token ID ${token.id} (${token.name}) worked after being marked invalid. Resetting status.`);
             await tokenStore.updateToken(token.id, { isValid: true, status: 'valid', lastChecked: new Date().toISOString() });
        }


        if (isStreaming) {
            logger.debug('Streaming response detected.');
            await handleStreamingResponse(targetResponse, res);
        } else {
            // Handle standard JSON/text response
            const responseBody = await targetResponse.text(); // Read as text first
            // Copy headers from target response to client response
            targetResponse.headers.forEach((value, name) => {
                 // Avoid setting headers that cause issues (e.g., content-encoding if handled by fetch)
                 if (name.toLowerCase() !== 'content-encoding' && name.toLowerCase() !== 'transfer-encoding' && name.toLowerCase() !== 'connection') {
                    res.setHeader(name, value);
                 }
            });
             res.status(targetResponse.status).send(responseBody);
             logger.debug(`Proxied standard response (Status: ${targetResponse.status}, Length: ${responseBody.length})`);
        }

    } catch (error) {
        logger.error(`Proxy request failed for ${type} token ID ${token.id}:`, error);
        // Don't try to write headers again if they were already sent
        if (!res.headersSent) {
            res.status(502).json({ error: 'Proxy request failed', details: error.message });
        } else {
            // If headers sent (e.g., during streaming), just end the response
            res.end();
        }
    }
    };

    // Define routes for Google and OpenAI using router.use()
    // This acts like middleware for any path starting with /google or /openai
    router.use('/google', (req, res) => proxyRequest(req, res, 'google'));
    router.use('/openai', (req, res) => proxyRequest(req, res, 'openai'));

    module.exports = router;
