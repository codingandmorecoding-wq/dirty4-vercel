// R2-Only Search API - Uses only your uploaded content, no external sites
import https from 'https';

// R2 base URL
const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

// Cache for loaded batches
const batchCache = new Map();
let tagIndexCache = null;
let autocompleteCache = null;

// Load tag index
async function loadTagIndex() {
    if (tagIndexCache) return tagIndexCache;

    try {
        console.log('Loading tag index from R2...');
        const response = await fetch(`${R2_BASE_URL}/indices/tag-index.json`);
        const data = await response.json();
        tagIndexCache = data;
        console.log(`Loaded tag index: ${Object.keys(data).length} tags`);
        return data;
    } catch (error) {
        console.error('Failed to load tag index:', error);
        tagIndexCache = {};
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
        const response = await fetch(`${R2_BASE_URL}/indices/items/batch-${String(batchNumber).padStart(3, '0')}.json`);
        const data = await response.json();
        batchCache.set(batchNumber, data);
        console.log(`Loaded batch ${batchNumber}: ${data.total_items} items`);
        return data;
    } catch (error) {
        console.error(`Failed to load batch ${batchNumber}:`, error);
        return { items: [], total_items: 0 };
    }
}

// Load autocomplete index
async function loadAutocompleteIndex() {
    if (autocompleteCache) return autocompleteCache;

    try {
        console.log('Loading autocomplete index from R2...');
        const response = await fetch(`${R2_BASE_URL}/indices/autocomplete-index.json`);
        const data = await response.json();
        autocompleteCache = data;
        console.log(`Loaded autocomplete index: ${data.total_unique_tags} tags`);
        return data;
    } catch (error) {
        console.error('Failed to load autocomplete index:', error);
        autocompleteCache = null;
        return null;
    }
}

// Search R2 content only
async function searchR2Content(tags, page = 1, limit = 42) {
    const queryLower = tags.toLowerCase().trim();

    // If no tags, return recent items from first batch
    if (!queryLower) {
        console.log('No search query, returning recent items...');
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
                rating: img.rating || 'safe',
                score: img.score || 0,
                created_at: img.created_at,
                source: 'r2-storage'
            })),
            total: batch1.total_items,
            source: 'r2-storage'
        };
    }

    // Load tag index and find matches
    const tagIndex = await loadTagIndex();
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

        for (const tag of partialMatches) {
            tagIndex[tag].forEach(id => matchingIds.add(id));
        }
        console.log(`Total unique matches: ${matchingIds.size}`);
    }

    if (matchingIds.size === 0) {
        console.log('No matches found in R2 storage');
        return { results: [], total: 0, source: 'r2-storage' };
    }

    // Load batches and find matching items
    const allItems = [];
    const matchingIdArray = Array.from(matchingIds);

    // Search through batches to find matching items
    for (let batchNum = 1; batchNum <= 60; batchNum++) {
        const batch = await loadBatch(batchNum);

        batch.items.forEach(item => {
            if (matchingIds.has(item.id)) {
                allItems.push(item);
            }
        });

        // Stop early if we've found all matches
        if (allItems.length >= matchingIds.size) {
            console.log(`Found all ${matchingIds.size} matches by batch ${batchNum}`);
            break;
        }
    }

    // Sort by score (highest first)
    allItems.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Paginate results
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
            rating: img.rating || 'safe',
            score: img.score || 0,
            created_at: img.created_at,
            source: 'r2-storage'
        })),
        total: allItems.length,
        source: 'r2-storage'
    };
}

// Autocomplete from R2 only
async function autocompleteR2(query, limit = 10) {
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

    const { tags = '', page = '1', limit = '42', mode = 'r2-only', autocomplete: autoQuery } = req.query;

    try {
        console.log(`R2-only search request: tags="${tags}", page=${page}`);

        // Autocomplete endpoint
        if (autoQuery) {
            const suggestions = await autocompleteR2(autoQuery, 20);
            return res.status(200).json(suggestions);
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        // Always search R2 content only
        const data = await searchR2Content(tags, pageNum, limitNum);

        return res.status(200).json({
            posts: data.results,
            total: data.total,
            page: pageNum,
            source: 'r2-storage-only',
            message: 'Results from your R2 storage only'
        });

    } catch (error) {
        console.error('R2 search error:', error);
        return res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
}