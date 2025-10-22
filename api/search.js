// Lightweight Search API - Uses optimized split indices
import https from 'https';

// R2 base URL
const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

// Cache for loaded batches
const batchCache = new Map();
const tagIndexCache = null;
const autocompleteCache = null;

// Load tag index (small file, loads instantly)
async function loadTagIndex() {
    try {
        console.log('Loading tag index...');
        const response = await fetch(`${R2_BASE_URL}/indices/tag-index.json`);
        const data = await response.json();
        console.log(`✅ Loaded tag index: ${Object.keys(data).length} tags`);
        return data;
    } catch (error) {
        console.error('Failed to load tag index:', error);
        return {};
    }
}

// Load specific item batch
async function loadBatch(batchNumber) {
    if (batchCache.has(batchNumber)) {
        return batchCache.get(batchNumber);
    }

    try {
        console.log(`Loading item batch ${batchNumber}...`);
        const response = await fetch(`${R2_BASE_URL}/indices/items/batch-${batchNumber:03d}.json`);
        const data = await response.json();
        batchCache.set(batchNumber, data);
        console.log(`✅ Loaded batch ${batchNumber}: ${data.total_items} items`);
        return data;
    } catch (error) {
        console.error(`Failed to load batch ${batchNumber}:`, error);
        return { items: [], total_items: 0 };
    }
}

// Load autocomplete index
async function loadAutocompleteIndex() {
    try {
        console.log('Loading autocomplete index...');
        const response = await fetch(`${R2_BASE_URL}/indices/autocomplete-index.json`);
        const data = await response.json();
        console.log(`✅ Loaded autocomplete index: ${data.total_unique_tags} tags`);
        return data;
    } catch (error) {
        console.error('Failed to load autocomplete index:', error);
        return null;
    }
}

// Search function
async function searchHistorical(tags, page = 1, limit = 42) {
    const queryLower = tags.toLowerCase().trim();

    if (!queryLower) {
        // Return recent items from first batch
        const batch1 = await loadBatch(1);
        const start = (page - 1) * limit;
        const results = batch1.items.slice(start, start + limit);

        return {
            results: results.map(img => ({
                id: img.id,
                file_url: `${R2_BASE_URL}/${img.file_url}`,
                preview_url: `${R2_BASE_URL}/${img.thumbnail_url}`,
                large_file_url: `${R2_BASE_URL}/${img.file_url}`,
                thumbnailUrl: `${R2_BASE_URL}/${img.thumbnail_url}`,
                tag_string: (img.tags || []).join(' '),
                tag_string_artist: img.artist || '',
                rating: img.rating,
                score: img.score || 0,
                created_at: img.created_at,
                source: 'historical-optimized'
            })),
            total: batch1.total_items,
            source: 'historical-optimized'
        };
    }

    // Load tag index
    const tagIndex = await loadTagIndex();

    // Find matching item IDs
    let matchingIds = new Set();

    // Try exact match first
    if (tagIndex[queryLower]) {
        matchingIds = new Set(tagIndex[queryLower]);
        console.log(`Found ${matchingIds.size} exact matches for "${queryLower}"`);
    }

    // If no exact match, try partial matches
    if (matchingIds.size === 0) {
        const partialMatches = Object.keys(tagIndex).filter(tag => tag.includes(queryLower));
        console.log(`Found ${partialMatches.length} partial matches for "${queryLower}"`);

        for (tag of partialMatches) {
            tagIndex[tag].forEach(id => matchingIds.add(id));
        }
        console.log(`Total unique matches: ${matchingIds.size}`);
    }

    if (matchingIds.size === 0) {
        console.log('No matches found');
        return { results: [], total: 0, source: 'historical-optimized' };
    }

    // Since we can't predict which batch contains which IDs, load all batches until we find matches
    const allItems = [];
    let batchesToCheck = 60; // Total number of batches
    let foundAllMatches = false;

    for (let batchNum = 1; batchNum <= batchesToCheck && !foundAllMatches; batchNum++) {
        console.log(`Loading batch ${batchNum} to search for matches...`);
        const batch = await loadBatch(batchNum);

        // Add items from this batch that match our IDs
        batch.items.forEach(item => {
            if (matchingIds.has(item.id)) {
                allItems.push(item);
            }
        });

        // Stop early if we've found all matching items
        if (allItems.length >= matchingIds.size) {
            foundAllMatches = true;
            console.log(`Found all ${matchingIds.size} matches by batch ${batchNum}`);
        }
    }

    // Sort by score
    allItems.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Paginate
    const start = (page - 1) * limit;
    const results = allItems.slice(start, start + limit);

    console.log(`Returning ${results.length} results from ${allItems.length} total matches`);

    return {
        results: results.map(img => ({
            id: img.id,
            file_url: `${R2_BASE_URL}/${img.file_url}`,
            preview_url: `${R2_BASE_URL}/${img.thumbnail_url}`,
            large_file_url: `${R2_BASE_URL}/${img.file_url}`,
            thumbnailUrl: `${R2_BASE_URL}/${img.thumbnail_url}`,
            tag_string: (img.tags || []).join(' '),
            tag_string_artist: img.artist || '',
            rating: img.rating,
            score: img.score || 0,
            created_at: img.created_at,
            source: 'historical-optimized'
        })),
        total: allItems.length,
        source: 'historical-optimized'
    };
}

// Search Danbooru (unchanged)
async function searchDanbooru(tags, page = 1, limit = 20) {
    return new Promise((resolve) => {
        const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tags)}&page=${page}&limit=${limit}`;

        https.get(url, {
            headers: {
                'User-Agent': 'Dirty4/1.0 (anime art gallery)',
                'Accept': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const posts = JSON.parse(data);
                    resolve({
                        results: posts.filter(post => {
                            const hasFileUrl = post.file_url && post.file_url.trim() !== '';
                            const hasLargeUrl = post.large_file_url && post.large_file_url.trim() !== '';
                            const hasPreviewUrl = post.preview_file_url && post.preview_file_url.trim() !== '';
                            return hasFileUrl || hasLargeUrl || hasPreviewUrl;
                        }).map(post => ({
                            id: post.id,
                            file_url: post.file_url || post.large_file_url || post.preview_file_url,
                            preview_url: post.preview_file_url || post.large_file_url || post.file_url,
                            large_file_url: post.large_file_url || post.file_url || post.preview_file_url,
                            thumbnailUrl: post.preview_file_url || post.large_file_url || post.file_url,
                            tag_string: post.tag_string || '',
                            tag_string_artist: post.tag_string_artist || '',
                            rating: post.rating || 'q',
                            score: post.score || 0,
                            created_at: post.created_at,
                            file_ext: post.file_ext || '',
                            source: 'danbooru'
                        })),
                        total: posts.length,
                        source: 'danbooru'
                    });
                } catch (error) {
                    console.error('Danbooru parse error:', error);
                    resolve({ results: [], total: 0, source: 'danbooru' });
                }
            });
        }).on('error', (error) => {
            console.error('Danbooru request error:', error);
            resolve({ results: [], total: 0, source: 'danbooru' });
        });
    });
}

// Autocomplete tags
async function autocomplete(query, limit = 10) {
    const autocompleteIndex = await loadAutocompleteIndex();
    if (!autocompleteIndex || !autocompleteIndex.tags) {
        return [];
    }

    const queryLower = query.toLowerCase().trim();
    if (!queryLower) return [];

    // Find tags matching query
    const matches = Object.keys(autocompleteIndex.tags)
        .filter(tag => tag.includes(queryLower))
        .slice(0, limit)
        .map(tag => ({
            name: tag,
            post_count: autocompleteIndex.tags[tag].length,
            category: 0
        }));

    return matches;
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { tags = '', page = '1', limit = '42', mode = 'unified', autocomplete: autoQuery } = req.query;

    try {
        console.log(`Optimized search request: tags="${tags}", page=${page}, mode=${mode}`);

        // Autocomplete endpoint
        if (autoQuery) {
            const suggestions = await autocomplete(autoQuery, 20);
            return res.status(200).json(suggestions);
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        // Unified mode: Search optimized historical first, use Danbooru as fallback
        if (mode === 'unified' || mode === 'all') {
            const historicalData = await searchHistorical(tags, pageNum, limitNum);

            // If historical has enough results, return those only
            if (historicalData.results.length >= limitNum) {
                return res.status(200).json({
                    posts: historicalData.results.slice(0, limitNum),
                    total: historicalData.total,
                    page: pageNum,
                    sources: {
                        historical: historicalData.total,
                        danbooru: 0
                    },
                    mode: 'unified-optimized'
                });
            }

            // If historical has some results but not enough, fill remaining with Danbooru
            const remaining = limitNum - historicalData.results.length;
            const danbooruData = await searchDanbooru(tags, pageNum, remaining);

            const merged = [
                ...historicalData.results,
                ...danbooruData.results
            ];

            return res.status(200).json({
                posts: merged.slice(0, limitNum),
                total: historicalData.total + danbooruData.total,
                page: pageNum,
                sources: {
                    historical: historicalData.total,
                    danbooru: danbooruData.total
                },
                mode: 'unified-optimized'
            });
        }

        // Historical only
        if (mode === 'historical') {
            const data = await searchHistorical(tags, pageNum, limitNum);
            return res.status(200).json({
                posts: data.results,
                total: data.total,
                page: pageNum,
                source: 'historical-optimized'
            });
        }

        // Danbooru only
        if (mode === 'danbooru') {
            const data = await searchDanbooru(tags, pageNum, limitNum);
            return res.status(200).json({
                posts: data.results,
                total: data.total,
                page: pageNum,
                source: 'danbooru'
            });
        }

        // Default: unified
        const data = await searchHistorical(tags, pageNum, limitNum);
        return res.status(200).json({
            posts: data.results,
            total: data.total,
            page: pageNum,
            source: 'historical-optimized'
        });

    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
}
