export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const query = req.query || {};
    const tags = query.tags || '';
    const page = query.page || '1';
    const limit = query.limit || '42';
    const mode = query.mode || 'unified';

    return res.status(200).json({
        message: 'Search working',
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