// Simplified Search API - Direct chunk access without manifest
import https from 'https';

// R2 base URL
const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

// Cache for loaded chunks
const tagChunkCache = new Map();
// Cache for loaded batches
const batchCache = new Map();

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

// Load specific batch with caching
async function loadBatch(batchNum) {
    const batchKey = `batch-${String(batchNum).padStart(3, '0')}`;

    if (batchCache.has(batchKey)) {
        return batchCache.get(batchKey);
    }

    try {
        const response = await fetch(`${R2_BASE_URL}/indices/items/${batchKey}.json`, {
            signal: AbortSignal.timeout(5000) // Reduced timeout
        });

        if (response.ok) {
            const batch = await response.json();
            batchCache.set(batchKey, batch);
            return batch;
        }
    } catch (error) {
        console.error(`Failed to load batch ${batchKey}:`, error);
    }
    return null;
}

// Cache for detected extensions
const extensionCache = new Map();

// Fast file extension detection (optimized for performance)
async function getActualFileExtension(imageId) {
    if (extensionCache.has(imageId)) {
        return extensionCache.get(imageId);
    }

    try {
        // Just check if it's a video or image - faster than checking all extensions
        const testUrl = `${R2_BASE_URL}/images/historical_${imageId}.jpg`;
        const response = await fetch(testUrl, { method: 'HEAD', signal: AbortSignal.timeout(500) });

        if (response.ok) {
            extensionCache.set(imageId, 'jpg');
            return 'jpg';
        } else {
            // Try video formats
            const mp4Url = `${R2_BASE_URL}/images/historical_${imageId}.mp4`;
            const mp4Response = await fetch(mp4Url, { method: 'HEAD', signal: AbortSignal.timeout(500) });

            if (mp4Response.ok) {
                extensionCache.set(imageId, 'mp4');
                return 'mp4';
            } else {
                // Try gif
                const gifUrl = `${R2_BASE_URL}/images/historical_${imageId}.gif`;
                const gifResponse = await fetch(gifUrl, { method: 'HEAD', signal: AbortSignal.timeout(500) });

                if (gifResponse.ok) {
                    extensionCache.set(imageId, 'gif');
                    return 'gif';
                }
            }
        }

        extensionCache.set(imageId, 'jpg'); // Fallback
        return 'jpg';
    } catch (error) {
        extensionCache.set(imageId, 'jpg'); // Fallback on error
        return 'jpg';
    }
}

// Optimized search using parallel batch loading and caching
async function searchDirect(tags, page = 1, limit = 42) {
    console.log('=== SEARCH DEBUG ===');
    const queryLower = tags.toLowerCase().trim();

    if (!queryLower) {
        // Return sample content for empty search
        const sampleBatch = await loadSampleBatch();
        if (sampleBatch) {
            // Create results without file extension detection (for speed)
            const sampleItems = sampleBatch.items.slice(0, limit);
            const results = sampleItems.map(img => {
                const imageId = img.id.replace('_metadata', '');
                const fileExtension = img.file_url.split('.').pop(); // Use metadata extension for speed

                return {
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
                };
            });

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

    // Smart batch loading: search all batches but optimize for speed and pagination
    const allMatchingItems = [];
    const totalBatches = 60; // Search all batches for complete results
    let batchesSearched = 0;

    // Determine search scope based on query popularity and results
    let batchesToSearch = 20; // Default
    if (matchingIds.length > 500) {
        batchesToSearch = 40; // Search more batches for popular tags
    }
    if (matchingIds.length > 1000) {
        batchesToSearch = 60; // Search all batches for very popular tags
    }

    // Calculate which batches we need to search based on pagination
    const startBatch = 1; // Always start from beginning for complete results
    const endBatch = Math.min(startBatch + batchesToSearch - 1, totalBatches);

    console.log(`Searching batches ${startBatch} to ${endBatch} for page ${page}`);

    try {
        // Load batches in parallel chunks for speed
        for (let chunkStart = startBatch; chunkStart <= endBatch; chunkStart += 10) {
            const chunkEnd = Math.min(chunkStart + 9, endBatch);
            const batchPromises = [];

            // Prepare 10 batches to load in parallel
            for (let batchNum = chunkStart; batchNum <= chunkEnd; batchNum++) {
                batchPromises.push(loadBatch(batchNum));
            }

            console.log(`Loading batches ${chunkStart}-${chunkEnd} in parallel...`);
            const batchResults = await Promise.allSettled(batchPromises);

            // Process results from this chunk
            for (let i = 0; i < batchResults.length; i++) {
                const result = batchResults[i];
                const batchNum = chunkStart + i;

                if (result.status === 'fulfilled' && result.value) {
                    const batch = result.value;
                    batchesSearched++;

                    // Find items in this batch that match our IDs
                    const batchMatches = batch.items.filter(item => matchingIds.includes(item.id));
                    allMatchingItems.push(...batchMatches);

                    console.log(`Batch ${batchNum}: found ${batchMatches.length} matching items (total: ${allMatchingItems.length})`);
                } else {
                    console.log(`Batch ${batchNum}: failed to load`);
                }
            }

            // Early exit if we have enough results for current page
            const neededForPage = page * limit;
            if (allMatchingItems.length >= neededForPage) {
                console.log(`Found sufficient results for page ${page}, stopping search`);
                break;
            }
        }

        console.log(`Searched ${batchesSearched} batches in parallel chunks`);
    } catch (error) {
        console.error('Error in parallel batch loading:', error);
    }

    // Sort by score (highest first)
    allMatchingItems.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Paginate results
    const start = (page - 1) * limit;
    const paginatedResults = allMatchingItems.slice(start, start + limit);

    // Create results without file extension detection (for speed)
    const results = paginatedResults.map(img => {
        const imageId = img.id.replace('_metadata', '');
        const fileExtension = img.file_url.split('.').pop(); // Use metadata extension for speed

        return {
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
        };
    });

    const hasMoreResults = batchesSearched < totalBatches && allMatchingItems.length < matchingIds.length;

    console.log(`Returning ${results.length} results from ${batchesSearched || 0} batches (total matches: ${allMatchingItems.length}/${matchingIds.length})`);

    return {
        results,
        total: matchingIds.length,
        source: 'r2-storage-direct',
        hasMoreResults,
        batchesSearched,
        totalBatches: matchingIds.length
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