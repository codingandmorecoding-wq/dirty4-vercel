export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const query = req.query || {};
    const tags = query.tags || '';

    return res.status(200).json({
        message: 'Search v2 working!',
        tags: tags,
        posts: [],
        total: 0,
        source: 'searchv2',
        timestamp: new Date().toISOString()
    });
}