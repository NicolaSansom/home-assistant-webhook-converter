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

// Serve the link generator form
app.get('/generate', (req, res) => {
  const htmlPath = path.join(__dirname, 'views', 'generate.html');
  res.sendFile(htmlPath);
});

// Root path redirects to generator for friendly URL
app.get('/', (req, res) => {
  res.redirect('/generate');
});

// Helper function to check if request is from a browser
const isBrowserRequest = (req) => {
  const userAgent = req.get('User-Agent') || '';
  return (
    userAgent.includes('Mozilla') ||
    userAgent.includes('Chrome') ||
    userAgent.includes('Safari') ||
    userAgent.includes('Firefox') ||
    userAgent.includes('Edge')
  );
};

// Helper function to extract automation name from query params or URL
const getAutomationName = (req, targetUrl) => {
  // Check for 'name' query parameter first
  if (req.query.name) {
    return req.query.name;
  }

  // Try to extract from target URL (e.g., webhook name in path)
  if (targetUrl) {
    const webhookMatch = targetUrl.match(/webhook\/([^/?]+)/i);
    if (webhookMatch) {
      return webhookMatch[1].replace(/-/g, ' ').replace(/_/g, ' ');
    }
  }

  return null;
};

// Helper function to render success HTML page
const renderSuccessPage = (automationName) => {
  const displayName = automationName || 'Automation';
  const htmlPath = path.join(__dirname, 'views', 'success.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(/\{\{AUTOMATION_NAME\}\}/g, displayName);
  return html;
};

// Helper function to render error HTML page
const renderErrorPage = (errorMessage) => {
  const htmlPath = path.join(__dirname, 'views', 'error.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(/\{\{ERROR_MESSAGE\}\}/g, errorMessage);
  return html;
};

// Main GET to POST conversion - NO AUTH REQUIRED
app.get('/convert', async (req, res) => {
  try {
    const targetUrl = req.query.target;
    const isBrowser = isBrowserRequest(req);

    if (!targetUrl) {
      if (isBrowser) {
        return res
          .status(400)
          .send(
            renderErrorPage(
              'Missing target parameter. Please provide a target URL.'
            )
          );
      }
      return res.status(400).json({
        error: 'Missing target parameter',
        example:
          '/convert?target=http://YOUR_NAS_IP:8123/api/webhook/YOUR-WEBHOOK-ID&sensor=temp&value=22',
      });
    }

    // Extract all params except 'target' and 'name'
    const { target: _target, name: _name, ...postData } = req.query;

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

    // If browser request, return HTML page
    if (isBrowser) {
      const automationName = getAutomationName(req, targetUrl);
      return res.send(renderSuccessPage(automationName));
    }

    // Otherwise return JSON
    res.json({
      success: true,
      status: response.status,
      message: 'Data sent to Home Assistant',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log(`❌ Error: ${error.message}`);
    const isBrowser = isBrowserRequest(req);

    if (isBrowser) {
      const errorMessage = error.response
        ? `Home Assistant error: ${error.message}`
        : `Request failed: ${error.message}`;
      return res
        .status(error.response?.status || 500)
        .send(renderErrorPage(errorMessage));
    }

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
