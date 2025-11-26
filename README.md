# E-Bike Battery Tracker

A web application to track e-bike battery usage and remaining mileage, with GitHub OAuth authentication and Upstash Redis for data storage.

## Features

- Track e-bike battery usage and remaining mileage
- Quick-add destinations with one-click mileage logging
- Battery percentage display and calibration
- GitHub OAuth authentication
- Data persistence with Upstash Redis
- Cross-device synchronization

## Technology Stack

- Node.js with Express.js
- Upstash Redis for data storage
- GitHub OAuth for authentication
- Pure HTML/CSS/JavaScript frontend
- Deployed on Vercel

## Setup Instructions

### 1. Create GitHub OAuth App

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Set the Homepage URL to your deployed URL
4. Set the Authorization callback URL to `YOUR_DEPLOYED_URL/auth/github/callback`
5. Note down the Client ID and Client Secret

### 2. Create Upstash Redis Database

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create a new Redis database
3. Copy the REST API URL

### 3. Update Server Configuration

In `server.js`, update the configuration variables at the top of the file:

- Replace `UPSTASH_REDIS_URL` with your actual Upstash Redis URL
- Replace `GITHUB_CLIENT_ID` with your GitHub OAuth Client ID
- Replace `GITHUB_CLIENT_SECRET` with your GitHub OAuth Client Secret
- Replace `SESSION_SECRET` with a strong random secret
- Update `CORS_ORIGIN` if needed (currently set to '*' for development)
- Update `COOKIE_SECURE` to true if using HTTPS in production

### 4. Local Development

```bash
# Install dependencies
npm install

# Run the server locally
npm start
```

The application will be available at http://localhost:3000

### 5. Deployment to Vercel

1. Push your code to a GitHub repository
2. Go to [Vercel](https://vercel.com)
3. Import your project
4. Vercel will automatically detect the Node.js project and deploy it
5. Set environment variables if needed (though this project uses hardcoded values)

## API Endpoints

- `GET /auth/github` - Initiate GitHub OAuth
- `GET /auth/github/callback` - GitHub OAuth callback
- `POST /auth/logout` - Logout user
- `GET /auth/status` - Get authentication status
- `GET /api/data` - Get user's ebike data
- `POST /api/data` - Save user's ebike data
- `GET /health` - Health check endpoint

## Environment Variables

This project uses hardcoded values in server.js instead of environment variables. Update these values before deployment:

- `UPSTASH_REDIS_URL` - Your Upstash Redis URL
- `GITHUB_CLIENT_ID` - GitHub OAuth Client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth Client Secret
- `SESSION_SECRET` - Session secret for express-session

## License

MIT