// Fixed Search API - Uses splitted tag chunks to avoid string length limits
import https from 'https';

// R2 base URL
const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

// Cache for loaded chunks
const tagChunkCache = new Map();
let tagsManifest = null;

// Load tags manifest
async function loadTagsManifest() {
    if (tagsManifest) return tagsManifest;

    try {
        const response = await fetch(`${R2_BASE_URL}/indices/tags-splitted/tags-manifest.json`, {
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
            tagsManifest = await response.json();
            console.log(`Loaded tags manifest: ${tagsManifest.total_chunks} chunks`);
            return tagsManifest;
        }
    } catch (error) {
        console.error('Failed to load tags manifest:', error);
    }
    return null;
}

// Load specific tag chunk
async function loadTagChunk(chunkName) {
    if (tagChunkCache.has(chunkName)) {
        return tagChunkCache.get(chunkName);
    }

    try {
        console.log(`Loading tag chunk: ${chunkName}`);
        const response = await fetch(`${R2_BASE_URL}/indices/tags-splitted/tags-${chunkName}.json`, {
            signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
            const chunkData = await response.json();
            tagChunkCache.set(chunkName, chunkData.tags);
            console.log(`Loaded chunk ${chunkName}: ${chunkData.total_tags} tags`);
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

// Search using chunked tags
async function searchChunked(tags, page = 1, limit = 42) {
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

    // Determine which chunk might contain our query
    const firstChar = queryLower[0];
    let likelyChunks = [firstChar];

    // For 'equestria girls', check 'e' chunk
    if (queryLower.startsWith('equestria')) {
        likelyChunks = ['e'];
    }

    // Load the manifest to get available chunks
    const manifest = await loadTagsManifest();
    if (!manifest) {
        console.error('Cannot load tags manifest');
        return { results: [], total: 0, source: 'r2-storage' };
    }

    // Search through likely chunks
    let matchingIds = [];
    for (const chunkName of likelyChunks) {
        if (manifest.chunks.includes(`tags-${chunkName}.json`)) {
            const chunkTags = await loadTagChunk(chunkName);
            if (chunkTags) {
                // Look for exact match
                if (chunkTags[queryLower]) {
                    matchingIds = chunkTags[queryLower];
                    console.log(`Found ${matchingIds.length} exact matches in chunk ${chunkName}`);
                    break;
                }

                // Look for partial matches
                for (const tag in chunkTags) {
                    if (tag.includes(queryLower) || queryLower.includes(tag)) {
                        matchingIds.push(...chunkTags[tag]);
                    }
                }

                if (matchingIds.length > 0) {
                    console.log(`Found ${matchingIds.length} partial matches in chunk ${chunkName}`);
                    break;
                }
            }
        }
    }

    if (matchingIds.length === 0) {
        console.log(`No matches found for "${queryLower}"`);
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

    console.log(`Returning ${results.length} results from sample batch`);

    return {
        results,
        total: matchingIds.length,
        source: 'r2-storage-chunked'
    };
}

// Simple autocomplete using chunked data
async function autocompleteChunked(query, limit = 10) {
    const queryLower = query.toLowerCase().trim();
    if (!queryLower) return [];

    const firstChar = queryLower[0];
    const manifest = await loadTagsManifest();

    if (!manifest || !manifest.chunks.includes(`tags-${firstChar}.json`)) {
        return [];
    }

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

    const { tags = '', page = '1', limit = '42', mode = 'chunked', autocomplete: autoQuery } = req.query;

    try {
        console.log(`Chunked search request: tags="${tags}", page=${page}`);

        // Autocomplete endpoint
        if (autoQuery) {
            const suggestions = await autocompleteChunked(autoQuery, 20);
            return res.status(200).json(suggestions);
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        // Search using chunked tags
        const data = await searchChunked(tags, pageNum, limitNum);

        return res.status(200).json({
            posts: data.results,
            total: data.total,
            page: pageNum,
            source: data.source,
            message: 'Results from R2 storage using chunked tags',
            sources: {
                historical: data.total,
                danbooru: 0
            }
        });

    } catch (error) {
        console.error('Chunked search error:', error);
        return res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
}