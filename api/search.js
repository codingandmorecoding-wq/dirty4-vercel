// 🔍 UNIFIED SEARCH API - Merges Danbooru + Historical Archive
// Provides seamless search experience across all sources
// Updated: 2025-10-06 - Fixed file extensions in search index

import https from 'https';

// R2 URLs for search indexes
const INDEX_URLS = {
  search: 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev/search-index.json',
  autocomplete: 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev/search-index-autocomplete.json'
};

// Load search index from R2
let searchIndex = null;
let autocompleteIndex = null;
let loadingPromise = null;

async function loadIndexes() {
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      if (!searchIndex) {
        console.log('📥 Fetching search index from R2...');
        const response = await fetch(INDEX_URLS.search);
        searchIndex = await response.json();
        console.log(`✅ Loaded search index: ${searchIndex.totalImages} images`);
      }

      if (!autocompleteIndex) {
        console.log('📥 Fetching autocomplete index from R2...');
        const response = await fetch(INDEX_URLS.autocomplete);
        autocompleteIndex = await response.json();
        console.log(`✅ Loaded autocomplete index: ${autocompleteIndex.tags.length} tags`);
      }
    } catch (error) {
      console.error('Failed to load indexes from R2:', error);
    }
  })();

  return loadingPromise;
}

// Search historical archive
function searchHistorical(tags, page = 1, limit = 42) {
  if (!searchIndex) {
    return { results: [], total: 0, source: 'historical' };
  }

  const queryLower = tags.toLowerCase().trim();

  if (!queryLower) {
    // No tags = return recent images
    const start = (page - 1) * limit;
    const results = searchIndex.images.slice(start, start + limit);
    return {
      results: results.map(img => ({
        id: img.id,
        file_url: img.fileUrl,
        preview_url: img.thumbnailUrl,
        large_file_url: img.fileUrl,
        tag_string: (img.tags || []).join(' '),
        tag_string_artist: '',
        rating: img.rating,
        score: img.score || 0,
        created_at: img.createdAt,
        source: 'historical'
      })),
      total: searchIndex.totalImages,
      source: 'historical'
    };
  }

  // Try the full query as a single tag first (for multi-word tags like "genshin impact")
  let matchingIds = new Set(searchIndex.tagIndex[queryLower] || []);

  // If no results, try splitting into individual tags and use AND logic
  if (matchingIds.size === 0) {
    const tagList = queryLower.split(/\s+/).filter(t => t.length > 0);
    const matchingSets = tagList.map(tag => {
      return new Set(searchIndex.tagIndex[tag] || []);
    });

    // Intersection of all tag sets
    if (matchingSets.length > 0) {
      matchingIds = matchingSets[0];
      for (let i = 1; i < matchingSets.length; i++) {
        matchingIds = new Set([...matchingIds].filter(id => matchingSets[i].has(id)));
      }
    }
  }

  // Get image data for matching IDs
  const allMatches = Array.from(matchingIds)
    .map(id => searchIndex.images.find(img => img.id === id))
    .filter(img => img)
    .sort((a, b) => (b.score || 0) - (a.score || 0)); // Sort by score

  // Paginate
  const start = (page - 1) * limit;
  const results = allMatches.slice(start, start + limit);

  return {
    results: results.map(img => ({
      id: img.id,
      file_url: img.fileUrl,
      preview_url: img.thumbnailUrl,
      large_file_url: img.fileUrl,
      tag_string: (img.tags || []).join(' '),
      tag_string_artist: '',
      rating: img.rating,
      score: img.score || 0,
      created_at: img.createdAt,
      source: 'historical'
    })),
    total: allMatches.length,
    source: 'historical'
  };
}

// Search Danbooru
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
            results: posts.map(post => ({
              id: post.id,
              file_url: post.file_url || post.large_file_url,
              preview_url: post.preview_file_url || post.file_url,
              large_file_url: post.large_file_url || post.file_url,
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
function autocomplete(query, limit = 10) {
  if (!autocompleteIndex) {
    return [];
  }

  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return [];

  // Find tags matching query
  const matches = autocompleteIndex.tags
    .filter(item => item.tag.includes(queryLower))
    .slice(0, limit)
    .map(item => ({
      name: item.tag,
      post_count: item.count,
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

  // Load indexes on first request (wait for completion)
  await loadIndexes();

  const { tags = '', page = '1', limit = '42', mode = 'unified', autocomplete: autoQuery } = req.query;

  try {
    // Autocomplete endpoint
    if (autoQuery) {
      const suggestions = autocomplete(autoQuery, 20);
      return res.status(200).json(suggestions);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Unified mode: Search historical first, use Danbooru as fallback
    if (mode === 'unified' || mode === 'all') {
      const historicalData = searchHistorical(tags, pageNum, limitNum);

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
          mode: 'unified'
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
        mode: 'unified'
      });
    }

    // Historical only
    if (mode === 'historical') {
      const data = searchHistorical(tags, pageNum, limitNum);
      return res.status(200).json({
        posts: data.results,
        total: data.total,
        page: pageNum,
        source: 'historical'
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
    const data = searchHistorical(tags, pageNum, limitNum);
    return res.status(200).json({
      posts: data.results,
      total: data.total,
      page: pageNum,
      source: 'historical'
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
}
