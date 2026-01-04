const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const log = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());

  try {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logDir, 'app.log'), logMessage);
  } catch (err) {
    console.error('Log error:', err.message);
  }
};

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
  });
});

// Main GET to POST conversion - NO AUTH REQUIRED
app.get('/convert', async (req, res) => {
  try {
    const targetUrl = req.query.target;

    if (!targetUrl) {
      return res.status(400).json({
        error: 'Missing target parameter',
        example:
          '/convert?target=http://YOUR_NAS_IP:8123/api/webhook/YOUR-WEBHOOK-ID&sensor=temp&value=22',
      });
    }

    // Extract all params except 'target'
    const { target, ...postData } = req.query;

    log(`🔄 GET → POST Conversion`);
    log(`   From: ${req.ip}`);
    log(`   Target: ${targetUrl}`);
    log(`   Data: ${JSON.stringify(postData)}`);

    // Make POST request to Home Assistant
    const response = await axios.post(targetUrl, postData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Synology-Webhook-Converter/1.0',
      },
      timeout: 15000,
      validateStatus: (status) => status < 500,
    });

    log(`✅ Success: ${response.status}`);

    res.json({
      success: true,
      status: response.status,
      message: 'Data sent to Home Assistant',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log(`❌ Error: ${error.message}`);

    if (error.response) {
      return res.status(error.response.status).json({
        error: 'Home Assistant error',
        message: error.message,
        status: error.response.status,
      });
    }

    res.status(500).json({
      error: 'Request failed',
      message: error.message,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  log('🚀 Webhook Converter Started');
  log(`📡 Port: ${PORT}`);
  log(`🔧 Node: ${process.version}`);
  log(`🏠 Home Assistant Mode - Local Network`);
});
