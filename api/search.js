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

// Get actual file extension from R2 instead of metadata
async function getActualFileExtension(imageId) {
    try {
        // Common image/video extensions to try
        const extensions = ['jpg', 'png', 'gif', 'webp', 'mp4', 'webm'];

        for (const ext of extensions) {
            const testUrl = `${R2_BASE_URL}/images/historical_${imageId}.${ext}`;
            const response = await fetch(testUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
            if (response.ok) {
                console.log(`Found actual extension for ${imageId}: .${ext}`);
                return ext;
            }
        }

        // Fallback to metadata extension if can't determine
        console.log(`Could not determine actual extension for ${imageId}, will use metadata fallback`);
        return null;
    } catch (error) {
        console.log(`Error checking extension for ${imageId}: ${error.message}`);
        return null;
    }
}

// Search using direct chunk access
async function searchDirect(tags, page = 1, limit = 42) {
    const queryLower = tags.toLowerCase().trim();

    if (!queryLower) {
        // Return sample content for empty search
        const sampleBatch = await loadSampleBatch();
        if (sampleBatch) {
            // Create results with proper file extension detection
            const results = [];
            const sampleItems = sampleBatch.items.slice(0, limit);

            for (const img of sampleItems) {
                const imageId = img.id.replace('_metadata', '');

                // Try to get actual file extension from R2
                const actualExt = await getActualFileExtension(imageId);
                const fileExtension = actualExt || img.file_url.split('.').pop();

                results.push({
                    id: img.id,
                    file_url: `${R2_BASE_URL}/images/historical_${imageId}.${fileExtension}`,
                    preview_url: `${R2_BASE_URL}/thumbnails/historical_${imageId}_thumbnail.${img.thumbnail_url.split('.').pop()}`,
                    large_file_url: `${R2_BASE_URL}/images/historical_${imageId}.${fileExtension}`,
                    thumbnailUrl: `${R2_BASE_URL}/thumbnails/historical_${imageId}_thumbnail.${img.thumbnail_url.split('.').pop()}`,
                    tag_string: (img.tags || []).join(' '),
                    tag_string_artist: img.artist || '',
                    rating: img.rating || 'safe',
                    score: img.score || 0,
                    created_at: img.created_at,
                    source: 'r2-storage'
                });
            }

            return {
                results,
                total: sampleBatch.total_items,
                source: 'r2-storage-samples'
            };
        }
        return { results: [], total: 0, source: 'r2-storage' };
    }

    // Split query into individual tags
    const searchTags = queryLower.split(/\s+/).filter(tag => tag.length > 0);
    console.log(`Searching for posts with ALL tags: [${searchTags.join(', ')}]`);

    // Collect matching IDs for each tag
    const tagMatches = new Map();

    // Search for each tag in its respective chunk
    for (const tag of searchTags) {
        const firstChar = tag[0];
        console.log(`Looking for tag "${tag}" in chunk "${firstChar}"`);

        const chunkTags = await loadTagChunk(firstChar);
        if (!chunkTags) {
            console.log(`Failed to load chunk ${firstChar} for tag "${tag}"`);
            continue;
        }

        // Find exact matches first
        if (chunkTags[tag]) {
            tagMatches.set(tag, new Set(chunkTags[tag]));
            console.log(`Found ${chunkTags[tag].length} exact matches for tag "${tag}"`);
        } else {
            // Partial matches
            let partialMatches = [];
            for (const chunkTag in chunkTags) {
                if (chunkTag.includes(tag) || tag.includes(chunkTag)) {
                    partialMatches.push(...chunkTags[chunkTag]);
                }
            }
            tagMatches.set(tag, new Set(partialMatches));
            console.log(`Found ${partialMatches.length} partial matches for tag "${tag}"`);
        }
    }

    if (tagMatches.size === 0) {
        console.log(`No matches found for any tags in query "${queryLower}"`);
        return { results: [], total: 0, source: 'r2-storage' };
    }

    // Find intersection of all tag matches (posts that have ALL tags)
    const tagSets = Array.from(tagMatches.values());
    let matchingIds = tagSets.length > 0 ? [...tagSets[0]] : [];

    for (let i = 1; i < tagSets.length; i++) {
        matchingIds = matchingIds.filter(id => tagSets[i].has(id));
    }

    console.log(`Found ${matchingIds.length} posts that have ALL tags: [${searchTags.join(', ')}]`);

    // Search through all batches to find matching items
    const allMatchingItems = [];
    let batchesSearched = 0;
    const maxBatchesToSearch = 20; // Limit to avoid timeouts

    for (let batchNum = 1; batchNum <= maxBatchesToSearch && batchesSearched < maxBatchesToSearch; batchNum++) {
        try {
            console.log(`Searching batch ${batchNum} for matching items...`);
            const batchResponse = await fetch(`${R2_BASE_URL}/indices/items/batch-${String(batchNum).padStart(3, '0')}.json`, {
                signal: AbortSignal.timeout(10000)
            });

            if (batchResponse.ok) {
                const batch = await batchResponse.json();
                batchesSearched++;

                // Find items in this batch that match our IDs
                const batchMatches = batch.items.filter(item => matchingIds.includes(item.id));
                allMatchingItems.push(...batchMatches);

                console.log(`Batch ${batchNum}: found ${batchMatches.length} matching items (total: ${allMatchingItems.length})`);

                // Stop early if we have enough results
                if (allMatchingItems.length >= limit * 2) {
                    console.log(`Found sufficient results, stopping search`);
                    break;
                }
            }
        } catch (error) {
            console.log(`Error loading batch ${batchNum}: ${error.message}`);
        }
    }

    // Sort by score (highest first)
    allMatchingItems.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Paginate results
    const start = (page - 1) * limit;
    const paginatedResults = allMatchingItems.slice(start, start + limit);

    // Create results with proper file extension detection
    const results = [];
    for (const img of paginatedResults) {
        const imageId = img.id.replace('_metadata', '');

        // Try to get actual file extension from R2
        const actualExt = await getActualFileExtension(imageId);
        const fileExtension = actualExt || img.file_url.split('.').pop();

        results.push({
            id: img.id,
            file_url: `${R2_BASE_URL}/images/historical_${imageId}.${fileExtension}`,
            preview_url: `${R2_BASE_URL}/thumbnails/historical_${imageId}_thumbnail.${img.thumbnail_url.split('.').pop()}`,
            large_file_url: `${R2_BASE_URL}/images/historical_${imageId}.${fileExtension}`,
            thumbnailUrl: `${R2_BASE_URL}/thumbnails/historical_${imageId}_thumbnail.${img.thumbnail_url.split('.').pop()}`,
            tag_string: (img.tags || []).join(' '),
            tag_string_artist: img.artist || '',
            rating: img.rating || 'safe',
            score: img.score || 0,
            created_at: img.created_at,
            source: 'r2-storage'
        });
    }

    console.log(`Returning ${results.length} results from ${batchesSearched} batches (total matches: ${allMatchingItems.length})`);

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

    // Split query into words and get the last word for autocomplete
    const words = queryLower.split(/\s+/).filter(word => word.length > 0);
    const lastWord = words[words.length - 1];

    console.log(`Autocomplete for query "${queryLower}" -> focusing on last word "${lastWord}"`);

    if (lastWord.length === 0) return [];

    const firstChar = lastWord[0];
    const chunkTags = await loadTagChunk(firstChar);

    if (!chunkTags) return [];

    // Find tags that start with or contain the last word
    const matches = Object.keys(chunkTags)
        .filter(tag => tag.startsWith(lastWord) || tag.includes(lastWord))
        .slice(0, limit)
        .map(tag => ({
            name: tag,
            post_count: Array.isArray(chunkTags[tag]) ? chunkTags[tag].length : 0,
            category: 0
        }));

    console.log(`Found ${matches.length} autocomplete matches for "${lastWord}"`);
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