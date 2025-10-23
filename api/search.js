export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { tags = '', page = '1', limit = '42', mode = 'unified' } = req.query;

    return res.status(200).json({
        message: 'Search endpoint working!',
        method: req.method,
        url: req.url,
        query: req.query,
        tags: tags,
        page: page,
        limit: limit,
        mode: mode,
        timestamp: new Date().toISOString(),
        posts: [],
        total: 0,
        source: 'fixed-search'
    });
}