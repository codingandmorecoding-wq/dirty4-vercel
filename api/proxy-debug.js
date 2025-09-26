module.exports = function handler(req, res) {
    // Set CORS headers first
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url: targetUrl } = req.query;

    // Return debug info instead of making actual request
    return res.status(200).json({
        message: 'Proxy debug endpoint working!',
        method: req.method,
        url: req.url,
        targetUrl: targetUrl,
        query: req.query,
        timestamp: new Date().toISOString(),
        note: 'This is a debug version - not making actual proxy request yet'
    });
};