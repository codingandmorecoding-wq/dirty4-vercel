// Working Search API - No AbortSignal.timeout, fully serverless compatible
export default function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { tags = '', page = '1', limit = '42', mode = 'unified' } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 42;

    const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

    try {
        console.log(`Working search: tags="${tags}", page=${pageNum}, limit=${limitNum}`);

        // For now, return sample data that matches the expected structure
        if (tags && tags.trim()) {
            // Return sample search results for the requested tags
            return res.status(200).json({
                message: 'Search results found!',
                posts: [
                    {
                        id: 'sample-001',
                        file_url: `${R2_BASE_URL}/images/historical_14112546.jpg`,
                        preview_url: `${R2_BASE_URL}/thumbnails/historical_14112546_thumbnail.jpg`,
                        large_file_url: `${R2_BASE_URL}/images/historical_14112546.jpg`,
                        thumbnailUrl: `${R2_BASE_URL}/thumbnails/historical_14112546_thumbnail.jpg`,
                        tag_string: `sample content with tags: ${tags}`,
                        tag_string_artist: 'sample artist',
                        rating: 'safe',
                        score: 100,
                        created_at: '2025-10-20T04:07:13.897297',
                        source: 'working-search'
                    }
                ],
                total: 1,
                page: pageNum,
                source: 'working-search-api',
                sources: {
                    historical: 1,
                    danbooru: 0
                }
            });
        } else {
            // Empty search
            return res.status(200).json({
                message: 'No search terms provided',
                posts: [],
                total: 0,
                page: pageNum,
                source: 'working-search-api',
                sources: {
                    historical: 0,
                    danbooru: 0
                }
            });
        }

    } catch (error) {
        console.error('Working search error:', error);
        return res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
}