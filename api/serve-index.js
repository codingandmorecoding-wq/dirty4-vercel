// Serve search indices from private R2 bucket
import https from 'https';

// R2 configuration
const R2_CONFIG = {
  accountId: '64cfcd0d57d3b4c161226c161b0a5237',
  bucket: 'dirty4-historical',
  accessKeyId: '2b8536f35096cd5ac2a35955d9a24737',
  secretAccessKey: 'ef01c462cdada48be8bb603b9c4a57872154a6ead2ce79c66ce46b6c6f304817',
  sessionToken: 'OkIwulTti5XIQ5t06IfRNd0zJ_yn82s76Qda_pue'
};

// Cache the indices in memory
let cachedIndices = {
  search: null,
  autocomplete: null,
  lastFetch: 0,
  cacheDuration: 5 * 60 * 1000 // 5 minutes
};

async function fetchFromR2(key) {
  return new Promise((resolve, reject) => {
    const url = `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com/${R2_CONFIG.bucket}/${key}`;

    const options = {
      hostname: `${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
      path: `/${R2_CONFIG.bucket}/${key}`,
      method: 'GET',
      headers: {
        'Authorization': `AWS4-HMAC-SHA256 Credential=${R2_CONFIG.accessKeyId}/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/auto/s3/aws4_request`,
        'X-Amz-Date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
        'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
        'X-Amz-Security-Token': R2_CONFIG.sessionToken
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getCachedIndex(type) {
  const now = Date.now();

  // Check if cache is valid
  if (cachedIndices[type] && (now - cachedIndices.lastFetch) < cachedIndices.cacheDuration) {
    return cachedIndices[type];
  }

  // Fetch fresh data
  try {
    console.log(`Fetching ${type} index from R2...`);
    const key = type === 'search' ? 'search-index.json' : 'search-index-autocomplete.json';
    const data = await fetchFromR2(key);

    // Update cache
    cachedIndices[type] = data;
    cachedIndices.lastFetch = now;

    console.log(`✅ Loaded ${type} index: ${type === 'search' ? data.total_items : Object.keys(data.tags || {}).length} items`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${type} index:`, error);
    return cachedIndices[type] || null;
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type } = req.query;

  if (!type || (type !== 'search' && type !== 'autocomplete')) {
    return res.status(400).json({ error: 'Invalid type parameter' });
  }

  try {
    const data = await getCachedIndex(type);

    if (!data) {
      return res.status(404).json({ error: 'Index not found' });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Serve index error:', error);
    return res.status(500).json({ error: 'Failed to serve index' });
  }
}