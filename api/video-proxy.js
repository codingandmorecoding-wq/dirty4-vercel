import https from 'https';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url: targetUrl } = req.query;

    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    console.log(`Video proxy request to: ${targetUrl}`);

    return new Promise((resolve) => {
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Referer': 'https://rule34.xxx/'
            }
        };

        // Forward range header if present
        if (req.headers.range) {
            options.headers['Range'] = req.headers.range;
            console.log(`Forwarding Range header: ${req.headers.range}`);
        }

        const proxyReq = https.get(targetUrl, options, (proxyRes) => {
            console.log(`Video response status: ${proxyRes.statusCode}`);

            // Set response headers
            res.status(proxyRes.statusCode);

            // Forward important video headers
            if (proxyRes.headers['content-type']) {
                res.setHeader('Content-Type', proxyRes.headers['content-type']);
            } else {
                res.setHeader('Content-Type', 'video/mp4');
            }

            if (proxyRes.headers['content-length']) {
                res.setHeader('Content-Length', proxyRes.headers['content-length']);
            }

            if (proxyRes.headers['accept-ranges']) {
                res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
            } else {
                res.setHeader('Accept-Ranges', 'bytes');
            }

            if (proxyRes.headers['content-range']) {
                res.setHeader('Content-Range', proxyRes.headers['content-range']);
            }

            // Stream video data directly
            proxyRes.on('data', (chunk) => {
                res.write(chunk);
            });

            proxyRes.on('end', () => {
                console.log(`Video streaming completed`);
                res.end();
                resolve();
            });
        });

        proxyReq.on('error', (error) => {
            console.error('Video proxy error:', error);
            res.status(500).send('Video proxy error: ' + error.message);
            resolve();
        });

        proxyReq.setTimeout(60000, () => {
            proxyReq.destroy();
            console.error('Video request timeout');
            res.status(408).send('Video request timeout');
            resolve();
        });
    });
};