// Debug Search API - Find the root cause of timeouts
import https from 'https';

// R2 base URL
const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { tags = '', page = '1', limit = '42', mode = 'debug', autocomplete: autoQuery } = req.query;

    try {
        console.log(`=== DEBUG SEARCH START ===`);
        console.log(`Request: tags="${tags}", page=${page}, mode=${mode}`);
        const startTime = Date.now();

        // Autocomplete endpoint
        if (autoQuery) {
            console.log(`Autocomplete request for: "${autoQuery}"`);
            return res.status(200).json([
                { name: 'equestria girls', post_count: 548, category: 0 },
                { name: 'equestria', post_count: 1, category: 0 },
                { name: 'my little pony', post_count: 3710, category: 0 }
            ]);
        }

        // Test 1: Check if we can reach R2 at all
        console.log(`Step 1: Testing R2 connectivity...`);
        try {
            const testResponse = await fetch(`${R2_BASE_URL}/indices/manifest.json`, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            console.log(`Step 1 SUCCESS: R2 reachable, status: ${testResponse.status}`);
        } catch (error) {
            console.log(`Step 1 FAILED: R2 not reachable - ${error.message}`);
            return res.status(200).json({
                posts: [],
                total: 0,
                page: parseInt(page),
                error: 'R2_CONNECTIVITY_FAILED',
                message: `Cannot reach R2 storage: ${error.message}`,
                debug_step: 'R2 connectivity test failed'
            });
        }

        // Test 2: Try to load a small manifest file
        console.log(`Step 2: Loading manifest.json...`);
        let manifestData = null;
        try {
            const manifestResponse = await fetch(`${R2_BASE_URL}/indices/manifest.json`, {
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            if (manifestResponse.ok) {
                manifestData = await manifestResponse.json();
                console.log(`Step 2 SUCCESS: Manifest loaded, total_items: ${manifestData.total_items}`);
            } else {
                throw new Error(`HTTP ${manifestResponse.status}`);
            }
        } catch (error) {
            console.log(`Step 2 FAILED: Cannot load manifest - ${error.message}`);
            return res.status(200).json({
                posts: [],
                total: 0,
                page: parseInt(page),
                error: 'MANIFEST_LOAD_FAILED',
                message: `Cannot load manifest.json: ${error.message}`,
                debug_step: 'Manifest loading failed'
            });
        }

        // Test 3: Try to load tag index (this might be the bottleneck)
        console.log(`Step 3: Loading tag-index.json...`);
        let tagIndex = null;
        try {
            const tagResponse = await fetch(`${R2_BASE_URL}/indices/tag-index.json`, {
                signal: AbortSignal.timeout(15000) // 15 second timeout
            });
            if (tagResponse.ok) {
                console.log(`Step 3: Response received, parsing JSON...`);
                tagIndex = await tagResponse.json();
                console.log(`Step 3 SUCCESS: Tag index loaded, tags: ${Object.keys(tagIndex).length}`);
            } else {
                throw new Error(`HTTP ${tagResponse.status}`);
            }
        } catch (error) {
            console.log(`Step 3 FAILED: Cannot load tag index - ${error.message}`);
            return res.status(200).json({
                posts: [],
                total: 0,
                page: parseInt(page),
                error: 'TAG_INDEX_LOAD_FAILED',
                message: `Cannot load tag-index.json (641MB file): ${error.message}`,
                debug_step: 'Tag index loading failed - file too large for serverless',
                suggestion: 'Need to split tag-index.json into smaller files'
            });
        }

        // Test 4: Search for the specific query
        console.log(`Step 4: Searching for "${tags}"...`);
        const queryLower = tags.toLowerCase().trim();
        let matchingIds = [];

        if (queryLower && tagIndex) {
            if (tagIndex[queryLower]) {
                matchingIds = tagIndex[queryLower];
                console.log(`Step 4 SUCCESS: Found ${matchingIds.length} exact matches`);
            } else {
                // Try partial matches
                const partialMatches = Object.keys(tagIndex).filter(tag => tag.includes(queryLower));
                console.log(`Step 4: Found ${partialMatches.length} partial matches`);
                for (const tag of partialMatches.slice(0, 10)) { // Limit to avoid timeout
                    matchingIds.push(...tagIndex[tag]);
                }
                console.log(`Step 4 SUCCESS: Found ${matchingIds.length} total matches (partial)`);
            }
        }

        // Test 5: Load a sample batch to verify batch loading works
        console.log(`Step 5: Testing batch loading...`);
        let sampleBatch = null;
        try {
            const batchResponse = await fetch(`${R2_BASE_URL}/indices/items/batch-001.json`, {
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            if (batchResponse.ok) {
                sampleBatch = await batchResponse.json();
                console.log(`Step 5 SUCCESS: Sample batch loaded, items: ${sampleBatch.total_items}`);
            } else {
                throw new Error(`HTTP ${batchResponse.status}`);
            }
        } catch (error) {
            console.log(`Step 5 FAILED: Cannot load batch - ${error.message}`);
            return res.status(200).json({
                posts: [],
                total: 0,
                page: parseInt(page),
                error: 'BATCH_LOAD_FAILED',
                message: `Cannot load batch file: ${error.message}`,
                debug_step: 'Batch loading failed'
            });
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        console.log(`=== DEBUG SEARCH COMPLETE ===`);
        console.log(`Total time: ${totalTime}ms`);
        console.log(`Matches found: ${matchingIds.length}`);

        // Return some real results if we found matches
        let results = [];
        if (matchingIds.length > 0 && sampleBatch) {
            // Find matching items in the sample batch
            results = sampleBatch.items
                .filter(item => matchingIds.includes(item.id))
                .slice(0, 10) // Limit to 10 results
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
                    source: 'r2-storage-debug'
                }));
        }

        return res.status(200).json({
            posts: results,
            total: matchingIds.length,
            page: parseInt(page),
            debug_info: {
                total_time_ms: totalTime,
                steps_completed: 5,
                tag_index_loaded: Object.keys(tagIndex || {}).length,
                matches_found: matchingIds.length,
                batch_items_loaded: sampleBatch?.total_items || 0,
                results_returned: results.length
            },
            source: 'r2-storage-debug',
            message: 'Debug search completed successfully'
        });

    } catch (error) {
        console.error('Debug search error:', error);
        return res.status(500).json({
            error: 'Debug search failed',
            message: error.message,
            stack: error.stack
        });
    }
}