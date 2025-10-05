import https from 'https';
import zlib from 'zlib';

export default function handler(req, res) {
    // Set CORS headers first (before any other code)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url: targetUrl } = req.query;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    console.log(`Proxying request to: ${targetUrl}`);

    // Wrap everything in try-catch to prevent 401 errors
    try {
        return new Promise((resolve) => {
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Referer': 'https://www.google.com/'
                }
            };

            const proxyReq = https.get(targetUrl, options, (proxyRes) => {
                console.log(`Response status: ${proxyRes.statusCode}`);

                const chunks = [];
                proxyRes.on('data', (chunk) => chunks.push(chunk));

                proxyRes.on('end', () => {
                    try {
                        let buffer = Buffer.concat(chunks);
                        const encoding = proxyRes.headers['content-encoding'];

                        const processData = (data) => {
                            console.log(`Processed data length: ${data.length}`);

                            // Check if we got a CAPTCHA or block page
                            if (data.includes('Cloudflare') && data.includes('challenge') ||
                                data.includes('captcha') ||
                                data.includes('CAPTCHA') ||
                                proxyRes.statusCode === 403) {
                                console.log('Detected CAPTCHA/block page');
                                res.status(200).json({
                                    contents: data,
                                    status: {
                                        http_code: proxyRes.statusCode,
                                        blocked: true,
                                        message: 'Request blocked by anti-bot protection'
                                    }
                                });
                                resolve();
                                return;
                            }

                            res.status(200).json({
                                contents: data,
                                status: { http_code: proxyRes.statusCode }
                            });
                            resolve();
                        };

                        // Handle different compression types
                        if (encoding === 'gzip') {
                            zlib.gunzip(buffer, (err, decompressed) => {
                                if (err) {
                                    console.error('Gzip decompression error:', err);
                                    res.status(500).json({
                                        error: 'Decompression failed',
                                        status: { http_code: 500 }
                                    });
                                    resolve();
                                    return;
                                }
                                processData(decompressed.toString('utf8'));
                            });
                        } else if (encoding === 'deflate') {
                            zlib.inflate(buffer, (err, decompressed) => {
                                if (err) {
                                    console.error('Deflate decompression error:', err);
                                    res.status(500).json({
                                        error: 'Decompression failed',
                                        status: { http_code: 500 }
                                    });
                                    resolve();
                                    return;
                                }
                                processData(decompressed.toString('utf8'));
                            });
                        } else if (encoding === 'br') {
                            try {
                                zlib.brotliDecompress(buffer, (err, decompressed) => {
                                    if (err) {
                                        console.error('Brotli decompression error:', err);
                                        processData(buffer.toString('utf8'));
                                        return;
                                    }
                                    processData(decompressed.toString('utf8'));
                                });
                            } catch (e) {
                                console.error('Brotli not supported, falling back to raw');
                                processData(buffer.toString('utf8'));
                            }
                        } else {
                            processData(buffer.toString('utf8'));
                        }
                    } catch (error) {
                        console.error('Data processing error:', error);
                        res.status(500).json({
                            error: 'Data processing failed',
                            status: { http_code: 500 }
                        });
                        resolve();
                    }
                });
            });

            proxyReq.on('error', (error) => {
                console.error('Proxy request error:', error);
                res.status(500).json({
                    error: error.message,
                    status: { http_code: 500 }
                });
                resolve();
            });

            proxyReq.setTimeout(30000, () => {
                proxyReq.destroy();
                console.error('Request timeout');
                res.status(408).json({
                    error: 'Request timeout',
                    status: { http_code: 408 }
                });
                resolve();
            });
        });
    } catch (error) {
        console.error('Function error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            status: { http_code: 500 }
        });
    }
};