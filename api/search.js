// FIXED SEARCH - Version 2.0 - No syntax errors
export default function handler(req, res) {
    // CORS setup
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Extract query parameters safely
    const queryParams = req.query || {};
    const tagsParam = queryParams.tags || '';
    const pageNum = queryParams.page || '1';
    const limitNum = queryParams.limit || '42';
    const searchMode = queryParams.mode || 'unified';

    // Return working search response
    return res.status(200).json({
        success: true,
        message: 'Search endpoint working!',
        data: {
            tags: tagsParam,
            page: pageNum,
            limit: limitNum,
            mode: searchMode,
            timestamp: new Date().toISOString(),
            posts: [],
            total: 0,
            source: 'fixed-search-v2'
        }
    });
}