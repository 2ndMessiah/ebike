const express = require('express');
const { Redis } = require('@upstash/redis');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const { formatInTimeZone, utcToZonedTime } = require('date-fns-tz');
const { subMonths, isBefore, parseISO } = require('date-fns');

// Configuration variables
// For Upstash Redis, ensure these two environment variables are set in Vercel
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL || 'https://primary-locust-20818.upstash.io';
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN || 'AVFSAAIncDE3OGQ1MjM4Nzk4MTY0ZDlmOWYxNWNlYTJlMTQ5NjhiYnAxMjA4MTg';

const JWT_SECRET = process.env.JWT_SECRET || 'Zei4R7!#K8NKz*86C%mgwU!2m^DQHU3T'; // A strong secret for JWT
const APP_USERNAME = process.env.APP_USERNAME || 'saywhat13'; // Default username
const APP_PASSWORD = process.env.APP_PASSWORD || 'of9s&t&$2#V#Q9LQ$Urcjs96He5K@^MX'; // Default password
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const EBIKE_DATA_EXPIRATION_SECONDS = 15552000; // 180 days

const DEFAULT_EBIKE_DATA = {
  totalMileage: 60,
  currentMileage: 0,
  destinations: [
    { "name": "Work", "mileage": 1.7 },
    { "name": "RY", "mileage": 7.7 },
    { "name": "房镇", "mileage": 3 },
    { "name": "花漾城", "mileage": 2.5 },
    { "name": "理工大", "mileage": 7.2 }
  ],
  selectedDestinations: []
};

const app = express();

// Set up Redis client for Upstash
const redisClient = new Redis({
  url: UPSTASH_REDIS_URL,
  token: UPSTASH_REDIS_TOKEN,
});

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
      res.json(data); // .get() from @upstash/redis already parses JSON
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
    const newData = req.body;
    const userId = req.user.id;
    const ebikeKey = `ebike:${userId}`;

    // Fetch existing data
    let existingData = await redisClient.get(ebikeKey);
    if (!existingData) {
      existingData = DEFAULT_EBIKE_DATA;
    }

    // Merge new data with existing data
    const updatedData = { ...existingData, ...newData };

    // Check if this is a full charge event
    if (newData.fullCharge) {
        updatedData.lastCharged = new Date().toISOString();
        delete updatedData.fullCharge; // Clean up the flag
    }

    // --- Daily Mileage Tracking Logic ---
    const now = new Date();
    const singaporeTime = utcToZonedTime(now, 'Asia/Singapore');
    // Use the client's date if provided, otherwise fall back to server-calculated Singapore date
    const todayFormatted = newData.clientDate || formatInTimeZone(singaporeTime, 'Asia/Singapore', 'yyyy-MM-dd');

    // Calculate the mileage to add for today
    const oldMileage = existingData ? parseFloat(existingData.currentMileage) || 0 : 0;
    const newMileage = newData ? parseFloat(newData.currentMileage) || 0 : 0;
    const mileageIncrement = newMileage - oldMileage;

    if (!updatedData.dailyMileage) {
      updatedData.dailyMileage = {};
    }

    // Only add positive increments to avoid issues on reset
    if (mileageIncrement > 0) {
      if (updatedData.dailyMileage[todayFormatted]) {
        updatedData.dailyMileage[todayFormatted] += mileageIncrement;
      } else {
        updatedData.dailyMileage[todayFormatted] = mileageIncrement;
      }
    } else if (!updatedData.dailyMileage[todayFormatted]) {
      // If it's a new day with no record, and mileage might have been reset, initialize it.
      // This handles the case where currentMileage is reset to 0, so the increment is negative.
      updatedData.dailyMileage[todayFormatted] = 0;
    }

    // --- Data Pruning Logic (retain last 6 months) ---
    const sixMonthsAgo = subMonths(singaporeTime, 6);
    for (const dateKey in updatedData.dailyMileage) {
      if (Object.prototype.hasOwnProperty.call(updatedData.dailyMileage, dateKey)) {
        const recordDate = parseISO(dateKey); // Parse the date string
        if (isBefore(recordDate, sixMonthsAgo)) {
          delete updatedData.dailyMileage[dateKey];
        }
      }
    }
    // --- End Daily Mileage Tracking Logic ---

    await redisClient.set(ebikeKey, updatedData, {
      ex: EBIKE_DATA_EXPIRATION_SECONDS
    });
    res.json({ message: 'Data saved successfully', updatedData });
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