const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API configuration
const API_URL = process.env.API_URL || 'http://localhost:8000';
let sessionId = null;

// Login to get session ID
async function login() {
    try {
        const response = await axios.post(`${API_URL}/login`, {
            password: process.env.API_PASSWORD || 'potatoes'
        });
        sessionId = response.data;
        console.log('Successfully logged in');
    } catch (error) {
        console.error('Login failed:', error.message);
    }
}

// Initialize login
login();

// Control bulb endpoint
app.post('/control/:device/:action', async (req, res) => {
    if (!sessionId) {
        await login();
    }

    try {
        const { device, action } = req.params;
        const response = await axios.get(`${API_URL}/actions/l530/${action}?device=${device}`, {
            headers: {
                'Authorization': `Bearer ${sessionId}`
            }
        });
        res.json({ success: true, message: `Bulb ${device} turned ${action}` });
    } catch (error) {
        console.error('Control failed:', error.message);
        res.status(500).json({ success: false, message: 'Failed to control bulb' });
    }
});

app.listen(port, () => {
    console.log(`Web interface running at http://localhost:${port}`);
}); 