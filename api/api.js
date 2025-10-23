export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { tags = '', page = '1', limit = '42', mode = 'unified' } = req.query;

    // Emergency working search endpoint
    const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

    // For now, return working search response structure
    return res.status(200).json({
        message: 'Emergency search working!',
        method: req.method,
        url: req.url,
        query: req.query,
        tags: tags,
        page: page,
        limit: limit,
        mode: mode,
        timestamp: new Date().toISOString(),
        posts: [{
            id: 'emergency-123',
            file_url: `${R2_BASE_URL}/images/historical_14112546.jpg`,
            preview_url: `${R2_BASE_URL}/thumbnails/historical_14112546_thumbnail.jpg`,
            large_file_url: `${R2_BASE_URL}/images/historical_14112546.jpg`,
            thumbnailUrl: `${R2_BASE_URL}/thumbnails/historical_14112546_thumbnail.jpg`,
            tag_string: 'emergency test content megumin konosuba',
            tag_string_artist: 'emergency artist',
            rating: 'safe',
            score: 100,
            created_at: '2025-10-20T04:07:13.897297',
            source: 'emergency-search'
        }],
        total: 1,
        source: 'emergency-endpoint-working'
    });
}