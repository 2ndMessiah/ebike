const express = require('express');
const redis = require('redis');
const cors = require('cors');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const session = require('express-session');
const cookieParser = require('cookie-parser');

// Configuration variables - Update these with your actual values
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL || 'YOUR_UPSTASH_REDIS_URL_HERE'; // Replace with your actual Upstash Redis URL
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'YOUR_GITHUB_CLIENT_ID_HERE'; // Replace with your GitHub OAuth App Client ID
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'YOUR_GITHUB_CLIENT_SECRET_HERE'; // Replace with your GitHub OAuth App Client Secret
const SESSION_SECRET = process.env.SESSION_SECRET || 'YOUR_SESSION_SECRET_HERE'; // Replace with a strong secret
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'; // You can change this to your specific domain in production
const COOKIE_SECURE = process.env.NODE_ENV === 'production'; // Set to true in production with HTTPS
const USER_DATA_EXPIRATION_SECONDS = 86400; // 24 hours (in seconds) for user data in Redis
const EBIKE_DATA_EXPIRATION_SECONDS = 2592000; // 30 days (in seconds) for ebike data in Redis

const app = express();

// Set up Redis client for Upstash KV
const redisClient = redis.createClient({
  url: UPSTASH_REDIS_URL
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

// Initialize Redis client
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
  origin: CORS_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(express.static('public')); // Serve static files
app.use(cookieParser());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: COOKIE_SECURE,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration for GitHub OAuth
passport.use(new GitHubStrategy({
  clientID: GITHUB_CLIENT_ID,
  clientSecret: GITHUB_CLIENT_SECRET,
  callbackURL: "/api/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
  // Store user information in Redis
  const userData = {
    id: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.emails ? profile.emails[0].value : null,
    avatar: profile.photos ? profile.photos[0].value : null
  };

  try {
    await redisClient.setex(`user:${profile.id}`, USER_DATA_EXPIRATION_SECONDS, JSON.stringify(userData));
    return done(null, userData);
  } catch (error) {
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const userData = await redisClient.get(`user:${id}`);
    if (userData) {
      done(null, JSON.parse(userData));
    } else {
      done(null, null);
    }
  } catch (error) {
    done(error, null);
  }
});

// Routes for authentication
app.get('/api/auth/github',
  passport.authenticate('github', { scope: ['user:email'] })
);

app.get('/api/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect to main app
    res.redirect('/');
  }
);

app.post('/api/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ error: 'Session destroy failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });
});

app.get('/api/auth/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});

// API routes for ebike data
app.get('/api/data', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const data = await redisClient.get(`ebike:${req.user.id}`);
    if (data) {
      res.json(JSON.parse(data));
    } else {
      // Return default data if user has no data yet
      const defaultData = {
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
      res.json(defaultData);
    }
  } catch (error) {
    console.error('Error getting data:', error);
    res.status(500).json({ error: 'Failed to get data' });
  }
});

app.post('/api/data', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }

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

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve static files from public directory
app.use(express.static('public'));

// Export the app for Vercel
module.exports = app;