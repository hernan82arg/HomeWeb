const express = require('express');
const axios = require('axios');
const path = require('path');
const pino = require('pino');
const pinoHttp = require('pino-http');
require('dotenv').config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(pinoHttp({ logger }));
app.use(express.static('public'));

// API configuration
const API_URL = process.env.API_URL || 'http://localhost:8000';
const DEVICE_TYPE = process.env.DEVICE_TYPE || 'l530';
let sessionId = null;

// Login to get session ID
async function login() {
    try {
        logger.info('Attempting to login to API');
        const response = await axios.post(`${API_URL}/login`, {
            password: process.env.API_PASSWORD
        });
        sessionId = response.data;
        logger.info('Successfully logged in');
    } catch (error) {
        logger.error({ err: error.message, response: error.response?.data }, 'Login failed');
    }
}

const VALID_ACTIONS = ['on', 'off'];
const VALID_DEVICES = ['living', 'room'];

// Control bulb endpoint
app.post('/control/:device/:action', async (req, res) => {
    const { device, action } = req.params;
    req.log.info({ device, action }, 'Control request received');

    if (!VALID_DEVICES.includes(device) || !VALID_ACTIONS.includes(action)) {
        req.log.warn({ device, action }, 'Invalid device or action');
        return res.status(400).json({ success: false, message: 'Invalid device or action' });
    }

    if (!sessionId) {
        req.log.warn('No session ID, attempting to login');
        await login();
    }

    try {
        const url = `${API_URL}/actions/${DEVICE_TYPE}/${action}?device=${device}`;
        req.log.info({ url }, 'Making API request');

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${sessionId}`
            }
        });

        req.log.info({ apiResponse: response.data }, 'API request successful');
        res.json({ success: true, message: `Bulb ${device} turned ${action}` });
    } catch (error) {
        req.log.error({ err: error.message, response: error.response?.data }, 'Control failed');
        res.status(500).json({ success: false, message: 'Failed to control bulb' });
    }
});

if (require.main === module) {
    login();
    app.listen(port, () => {
        logger.info({ port }, 'Web interface running');
    });
}

module.exports = { app, login };
