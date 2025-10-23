export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { tags = '', page = '1', limit = '42', mode = 'unified' } = req.query;

    // Test search logic - return search response for any request with tags
    if (tags && tags.trim() !== '') {
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
            posts: [{
                id: 'test-123',
                file_url: 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev/images/historical_14112546.jpg',
                preview_url: 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev/thumbnails/historical_14112546_thumbnail.jpg',
                large_file_url: 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev/images/historical_14112546.jpg',
                thumbnailUrl: 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev/thumbnails/historical_14112546_thumbnail.jpg',
                tag_string: 'test tag content here',
                tag_string_artist: 'test artist',
                rating: 'safe',
                score: 100,
                created_at: '2025-10-20T04:07:13.897297',
                source: 'test-search'
            }],
            total: 1,
            source: 'test-endpoint-search'
        });
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