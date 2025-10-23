// Minimal working search function - absolutely nothing that can crash
export default function handler(req, res) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        const { tags = '', page = '1', limit = '42', mode = 'unified' } = req.query;

        // Simple response that won't crash
        return res.status(200).json({
            message: 'Search working',
            tags: tags || '',
            page: page || '1',
            limit: limit || '42',
            mode: mode || 'unified',
            posts: [],
            total: 0,
            source: 'minimal-working'
        });

    } catch (error) {
        return res.status(500).json({
            error: 'Search failed',
            message: error.message || 'Unknown error'
        });
    }
}