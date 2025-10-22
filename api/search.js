// Simplified Search API - Direct chunk access without manifest
import https from 'https';

// R2 base URL
const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

// Cache for loaded chunks
const tagChunkCache = new Map();

// Load specific tag chunk directly
async function loadTagChunk(chunkName) {
    if (tagChunkCache.has(chunkName)) {
        return tagChunkCache.get(chunkName);
    }

    try {
        console.log(`Loading tag chunk: tags-${chunkName}`);
        const response = await fetch(`${R2_BASE_URL}/indices/tags-splitted/tags-${chunkName}.json`, {
            signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
            const chunkData = await response.json();
            console.log(`Loaded chunk ${chunkName}: ${chunkData.total_tags} tags`);
            tagChunkCache.set(chunkName, chunkData.tags);
            return chunkData.tags;
        }
    } catch (error) {
        console.error(`Failed to load chunk ${chunkName}:`, error);
    }
    return null;
}

// Load sample batch for getting actual items
async function loadSampleBatch() {
    try {
        const response = await fetch(`${R2_BASE_URL}/indices/items/batch-001.json`, {
            signal: AbortSignal.timeout(10000)
        });
        if (response.ok) {
            const batch = await response.json();
            console.log(`Loaded sample batch: ${batch.total_items} items`);
            return batch;
        }
    } catch (error) {
        console.error('Failed to load sample batch:', error);
    }
    return null;
}

// Search using direct chunk access
async function searchDirect(tags, page = 1, limit = 42) {
    const queryLower = tags.toLowerCase().trim();

    if (!queryLower) {
        // Return sample content for empty search
        const sampleBatch = await loadSampleBatch();
        if (sampleBatch) {
            const results = sampleBatch.items.slice(0, limit).map(img => ({
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
            }));

            return {
                results,
                total: sampleBatch.total_items,
                source: 'r2-storage-samples'
            };
        }
        return { results: [], total: 0, source: 'r2-storage' };
    }

    // Determine which chunk to check
    const firstChar = queryLower[0];
    console.log(`Looking for "${queryLower}" in chunk "${firstChar}"`);

    // Load the relevant chunk
    const chunkTags = await loadTagChunk(firstChar);
    if (!chunkTags) {
        console.log(`Failed to load chunk ${firstChar}`);
        return { results: [], total: 0, source: 'r2-storage' };
    }

    // Search for matches
    let matchingIds = [];

    // Exact match first
    if (chunkTags[queryLower]) {
        matchingIds = chunkTags[queryLower];
        console.log(`Found ${matchingIds.length} exact matches for "${queryLower}"`);
    } else {
        // Partial matches
        for (const tag in chunkTags) {
            if (tag.includes(queryLower) || queryLower.includes(tag)) {
                matchingIds.push(...chunkTags[tag]);
            }
        }
        console.log(`Found ${matchingIds.length} partial matches for "${queryLower}"`);
    }

    if (matchingIds.length === 0) {
        console.log(`No matches found for "${queryLower}" in chunk ${firstChar}`);
        return { results: [], total: 0, source: 'r2-storage' };
    }

    // Load sample batch and find matching items
    const sampleBatch = await loadSampleBatch();
    if (!sampleBatch) {
        return { results: [], total: matchingIds.length, source: 'r2-storage' };
    }

    const results = sampleBatch.items
        .filter(item => matchingIds.includes(item.id))
        .slice(0, limit)
        .map(img => ({
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
        }));

    console.log(`Returning ${results.length} results from sample batch (total matches: ${matchingIds.length})`);

    return {
        results,
        total: matchingIds.length,
        source: 'r2-storage-direct'
    };
}

// Simple autocomplete
async function autocompleteDirect(query, limit = 10) {
    const queryLower = query.toLowerCase().trim();
    if (!queryLower) return [];

    const firstChar = queryLower[0];
    const chunkTags = await loadTagChunk(firstChar);

    if (!chunkTags) return [];

    const matches = Object.keys(chunkTags)
        .filter(tag => tag.includes(queryLower))
        .slice(0, limit)
        .map(tag => ({
            name: tag,
            post_count: Array.isArray(chunkTags[tag]) ? chunkTags[tag].length : 0,
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
        console.log(`Search request: tags="${tags}", page=${page}, mode=${mode}`);

        // Autocomplete endpoint
        if (autoQuery) {
            const suggestions = await autocompleteDirect(autoQuery, 20);
            return res.status(200).json(suggestions);
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        // Search using direct chunk access
        const data = await searchDirect(tags, pageNum, limitNum);

        return res.status(200).json({
            posts: data.results,
            total: data.total,
            page: pageNum,
            source: data.source,
            message: 'Results from R2 storage using direct chunk access',
            sources: {
                historical: data.total,
                danbooru: 0
            }
        });

    } catch (error) {
        console.error('Direct search error:', error);
        return res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
}