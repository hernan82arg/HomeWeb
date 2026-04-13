const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const session = require('express-session');
const pino = require('pino');
const pinoHttp = require('pino-http');
require('dotenv').config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(pinoHttp({ logger }));
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict' },
}));

// API configuration
const API_URL = process.env.API_URL || 'http://localhost:8000';
const DEVICE_TYPE = process.env.DEVICE_TYPE || 'l530';
let apiSessionId = null;

// Login to upstream API
async function apiLogin() {
    try {
        logger.info('Attempting to login to API');
        const response = await axios.post(`${API_URL}/login`, {
            password: process.env.API_PASSWORD
        });
        apiSessionId = response.data;
        logger.info('Successfully logged in');
    } catch (error) {
        logger.error({ err: error.message, response: error.response?.data }, 'Login failed');
    }
}

// Auth middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.status(401).json({ success: false, message: 'Unauthorized' });
}

// Web login endpoint
app.post('/login', (req, res) => {
    const { password } = req.body;

    if (!process.env.WEB_PASSWORD) {
        req.log.error('WEB_PASSWORD not configured');
        return res.status(503).json({ success: false, message: 'Login not configured' });
    }

    if (password === process.env.WEB_PASSWORD) {
        req.session.authenticated = true;
        return res.json({ success: true });
    }

    req.log.warn('Failed login attempt');
    res.status(401).json({ success: false, message: 'Invalid password' });
});

// Logout endpoint
app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// Auth status endpoint
app.get('/auth/status', (req, res) => {
    res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile('login.html', { root: 'public' });
});

// Serve control panel (protected)
app.get('/', (req, res, next) => {
    if (!req.session || !req.session.authenticated) {
        return res.redirect('/login');
    }
    next();
});
app.use(express.static('public'));

const VALID_ACTIONS = ['on', 'off'];
const VALID_DEVICES = ['living', 'room'];

// Control bulb endpoint (protected)
app.post('/control/:device/:action', requireAuth, async (req, res) => {
    const { device, action } = req.params;
    req.log.info({ device, action }, 'Control request received');

    if (!VALID_DEVICES.includes(device) || !VALID_ACTIONS.includes(action)) {
        req.log.warn({ device, action }, 'Invalid device or action');
        return res.status(400).json({ success: false, message: 'Invalid device or action' });
    }

    if (!apiSessionId) {
        req.log.warn('No API session ID, attempting to login');
        await apiLogin();
    }

    try {
        const url = `${API_URL}/actions/${DEVICE_TYPE}/${action}?device=${device}`;
        req.log.info({ url }, 'Making API request');

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${apiSessionId}`
            }
        });

        req.log.info({ apiResponse: response.data }, 'API request successful');
        res.json({ success: true, message: `Bulb ${device} turned ${action}` });
    } catch (error) {
        req.log.error({ err: error.message, response: error.response?.data }, 'Control failed');
        res.status(500).json({ success: false, message: 'Failed to control bulb' });
    }
});

// Health check endpoint
app.get('/healthcheck', async (req, res) => {
    if (!process.env.API_PASSWORD) {
        return res.status(503).json({ status: 'error', message: 'API_PASSWORD not configured' });
    }

    try {
        await axios.post(`${API_URL}/login`, {
            password: process.env.API_PASSWORD
        });
        res.json({ status: 'ok' });
    } catch (error) {
        req.log.error({ err: error.message }, 'Health check failed');
        res.status(503).json({ status: 'error', message: 'API authentication failed' });
    }
});

if (require.main === module) {
    apiLogin();
    app.listen(port, () => {
        logger.info({ port }, 'Web interface running');
    });
}

module.exports = { app, apiLogin };
