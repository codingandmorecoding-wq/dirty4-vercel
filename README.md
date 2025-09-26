# Rule34 Vercel Backend

Vercel serverless functions backend for Rule34 Mobile Downloader - alternative to Netlify with better IP reputation.

## API Endpoints

- `/api/proxy?url=TARGET_URL` - Main proxy for HTML content
- `/api/video-proxy?url=VIDEO_URL` - Video streaming proxy

## Deployment Steps

### 1. Create Vercel Account
- Go to https://vercel.com
- Sign up with GitHub account

### 2. Deploy to Vercel

**Option A: GitHub Integration (Recommended)**
1. Push this folder to a new GitHub repository
2. In Vercel dashboard, click "New Project"
3. Import your GitHub repository
4. Vercel will auto-deploy

**Option B: Vercel CLI**
1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` in this directory
3. Follow the prompts

### 3. Get Your Vercel URL
After deployment, you'll get a URL like:
`https://your-project-name.vercel.app`

### 4. Update Frontend
Edit your GitHub Pages `app.js` file:
```javascript
const CONFIG = {
    PRODUCTION: true,
    API_BASE: 'https://your-project-name.vercel.app/api',
    VERSION: '1.0.0'
};
```

## Why Vercel Over Netlify?

- **Different IP ranges** - Often not blocked by anti-bot systems
- **Better reputation** with content sites
- **Edge network** - Global distribution
- **Fast cold starts** - Better performance

## Testing

Once deployed, test your endpoints:

**Proxy Test:**
```
https://your-project.vercel.app/api/proxy?url=https://httpbin.org/get
```

**Video Proxy Test:**
```
https://your-project.vercel.app/api/video-proxy?url=VIDEO_URL
```

## Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Features

- **CORS handled** - All cross-origin requests supported
- **Compression** - Gzip, deflate, brotli decompression
- **Video streaming** - Range request support
- **Error handling** - Comprehensive error responses
- **CAPTCHA detection** - Identifies and reports blocked requests

## Limits

Vercel Free Tier:
- 100GB bandwidth per month
- 100GB-hours compute per month
- 10-second execution timeout

Should be more than enough for your usage!