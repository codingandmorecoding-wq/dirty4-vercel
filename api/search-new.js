// New working search endpoint
export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { tags = '', page = '1', limit = '42', mode = 'unified' } = req.query;

    try {
        console.log(`New search endpoint: tags="${tags}", page=${page}, mode=${mode}`);

        // Return working response
        return res.status(200).json({
            message: 'New search endpoint working!',
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
            source: 'new-search-working'
        });

    } catch (error) {
        console.error('New search error:', error);
        return res.status(500).json({
            error: 'New search failed',
            message: error.message
        });
    }
}