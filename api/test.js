export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { tags = '', page = '1', limit = '42', mode = 'unified' } = req.query;

    // If this is a search request, handle it as search
    if (tags && tags.length > 0) {
        try {
            console.log(`Search via test endpoint: tags="${tags}", page=${page}, mode=${mode}`);

            return res.status(200).json({
                message: 'Search working via test endpoint!',
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
                source: 'test-endpoint-search-workaround'
            });

        } catch (error) {
            console.error('Search via test endpoint error:', error);
            return res.status(500).json({
                error: 'Search via test endpoint failed',
                message: error.message
            });
        }
    }

    // Regular test endpoint response
    return res.status(200).json({
        message: 'Test endpoint working!',
        method: req.method,
        url: req.url,
        query: req.query,
        timestamp: new Date().toISOString()
    });
}