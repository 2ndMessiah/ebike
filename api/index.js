const express = require('express');
const redis = require('redis');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

// Configuration variables
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL || 'rediss://default:AVFSAAIncDE3OGQ1MjM4Nzk4MTY0ZDlmOWYxNWNlYTJlMTQ5NjhiYnAxMjA4MTg@primary-locust-20818.upstash.io:6379';
const JWT_SECRET = process.env.JWT_SECRET || 'Zei4R7!#K8NKz*86C%mgwU!2m^DQHU3T'; // A strong secret for JWT
const APP_USERNAME = process.env.APP_USERNAME || 'saywhat13'; // Default username
const APP_PASSWORD = process.env.APP_PASSWORD || 'of9s&t&$2#V#Q9LQ$Urcjs96He5K@^MX'; // Default password
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const EBIKE_DATA_EXPIRATION_SECONDS = 15552000; // 180 days

const DEFAULT_EBIKE_DATA = {
  totalMileage: 60,
  currentMileage: 0,
  destinations: [
    { name: 'Home', mileage: 7.7 },
    { name: 'Work', mileage: 1.7 },
    { name: 'Fangzhen', mileage: 3 },
    { name: 'LGD', mileage: 7.2 }
  ],
  selectedDestinations: []
};

const app = express();

// Set up Redis client
const redisClient = redis.createClient({
  url: UPSTASH_REDIS_URL
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Upstash Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

// Middleware
app.use(cors({
  origin: CORS_ORIGIN
}));
app.use(express.json());
app.use(express.static('public'));

// --- Authentication ---

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (username === APP_USERNAME && password === APP_PASSWORD) {
    // User is authenticated, create a JWT
    const user = { id: '1', username: APP_USERNAME }; // Static user ID for single-user case
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.sendStatus(401); // No token, unauthorized
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403); // Invalid token
    }
    req.user = user;
    next();
  });
};

// Authentication status check
app.get('/api/auth/status', authenticateToken, (req, res) => {
  // If authenticateToken middleware passes, the user is authenticated
  res.json({ authenticated: true, user: req.user });
});


// --- API Routes for E-Bike Data ---

app.get('/api/data', authenticateToken, async (req, res) => {
  try {
    const data = await redisClient.get(`ebike:${req.user.id}`);
    if (data) {
      res.json(JSON.parse(data));
    } else {
      // Default data for a new user
      res.json(DEFAULT_EBIKE_DATA);
    }
  } catch (error) {
    console.error('Error getting data:', error);
    res.status(500).json({ error: 'Failed to get data' });
  }
});

app.post('/api/data', authenticateToken, async (req, res) => {
  try {
    const data = req.body;
    await redisClient.setex(`ebike:${req.user.id}`, EBIKE_DATA_EXPIRATION_SECONDS, JSON.stringify(data));
    res.json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve the main HTML file for the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Export the app for Vercel
module.exports = app;