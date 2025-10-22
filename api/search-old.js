// Lightweight search API - pre-indexed tag lookup for fast performance
import https from 'https';

// Pre-indexed tag lookup from a sample of the dataset
const PRE_INDEXED_TAGS = {
  'equestria girls': [
    { id: '14112157_metadata', tags: ['equestria girls', 'equestria untamed'], file_url: 'images/14112157_metadata.jpg', thumbnail_url: 'thumbnails/14112157_metadata.jpg' },
    { id: '14112168_metadata', tags: ['equestria girls', 'equestria untamed'], file_url: 'images/14112168_metadata.jpg', thumbnail_url: 'thumbnails/14112168_metadata.jpg' }
  ],
  'equestria untamed': [
    { id: '14112157_metadata', tags: ['equestria girls', 'equestria untamed'], file_url: 'images/14112157_metadata.jpg', thumbnail_url: 'thumbnails/14112157_metadata.jpg' },
    { id: '14112168_metadata', tags: ['equestria girls', 'equestria untamed'], file_url: 'images/14112168_metadata.jpg', thumbnail_url: 'thumbnails/14112168_metadata.jpg' }
  ],
  'equestria': [
    { id: '14112157_metadata', tags: ['equestria girls', 'equestria untamed'], file_url: 'images/14112157_metadata.jpg', thumbnail_url: 'thumbnails/14112157_metadata.jpg' },
    { id: '14112168_metadata', tags: ['equestria girls', 'equestria untamed'], file_url: 'images/14112168_metadata.jpg', thumbnail_url: 'thumbnails/14112168_metadata.jpg' }
  ]
};

// R2 base URL for images
const R2_BASE_URL = 'https://pub-4362d916855b41209502ea1705f6d048.r2.dev';

// Search function using pre-indexed data
function searchHistorical(tags, page = 1, limit = 42) {
  const queryLower = tags.toLowerCase().trim();

  if (!queryLower) {
    // Return random recent items when no search query
    const allItems = Object.values(PRE_INDEXED_TAGS).flat();
    const start = (page - 1) * limit;
    const results = allItems.slice(start, start + limit);

    return {
      results: results.map(item => ({
        id: item.id,
        file_url: `${R2_BASE_URL}/${item.file_url}`,
        preview_url: `${R2_BASE_URL}/${item.thumbnail_url}`,
        large_file_url: `${R2_BASE_URL}/${item.file_url}`,
        thumbnailUrl: `${R2_BASE_URL}/${item.thumbnail_url}`,
        tag_string: item.tags.join(' '),
        tag_string_artist: '',
        rating: 'safe',
        score: 0,
        created_at: '2025-01-01T00:00:00Z',
        source: 'historical-lightweight'
      })),
      total: allItems.length,
      source: 'historical-lightweight'
    };
  }

  // Search for exact or partial matches
  let results = [];

  // Try exact match first
  if (PRE_INDEXED_TAGS[queryLower]) {
    results = PRE_INDEXED_TAGS[queryLower];
  } else {
    // Try partial matches
    Object.keys(PRE_INDEXED_TAGS).forEach(tag => {
      if (tag.includes(queryLower) || queryLower.includes(tag)) {
        results.push(...PRE_INDEXED_TAGS[tag]);
      }
    });

    // Remove duplicates
    const seen = new Set();
    results = results.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  // Sort by tag relevance (exact matches first)
  results.sort((a, b) => {
    const aTags = a.tags.join(' ').toLowerCase();
    const bTags = b.tags.join(' ').toLowerCase();

    const aExactMatch = aTags === queryLower;
    const bExactMatch = bTags === queryLower;

    if (aExactMatch && !bExactMatch) return -1;
    if (!aExactMatch && bExactMatch) return 1;

    // Prefer shorter tag strings
    return aTags.length - bTags.length;
  });

  // Paginate
  const start = (page - 1) * limit;
  const paginatedResults = results.slice(start, start + limit);

  console.log(`Lightweight search for "${queryLower}": found ${results.length} total, returning ${paginatedResults.length}`);

  return {
    results: paginatedResults.map(item => ({
      id: item.id,
      file_url: `${R2_BASE_URL}/${item.file_url}`,
      preview_url: `${R2_BASE_URL}/${item.thumbnail_url}`,
      large_file_url: `${R2_BASE_URL}/${item.file_url}`,
      thumbnailUrl: `${R2_BASE_URL}/${item.thumbnail_url}`,
      tag_string: item.tags.join(' '),
      tag_string_artist: '',
      rating: 'safe',
      score: 0,
      created_at: '2025-01-01T00:00:00Z',
      source: 'historical-lightweight'
    })),
    total: results.length,
    source: 'historical-lightweight'
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
function autocomplete(query, limit = 10) {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return [];

  // Search pre-indexed tags
  const matches = Object.keys(PRE_INDEXED_TAGS)
    .filter(tag => tag.includes(queryLower))
    .slice(0, limit)
    .map(tag => ({
      name: tag,
      post_count: PRE_INDEXED_TAGS[tag].length,
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
    console.log(`Lightweight search request: tags="${tags}", page=${page}, mode=${mode}`);

    // Autocomplete endpoint
    if (autoQuery) {
      const suggestions = autocomplete(autoQuery, 20);
      return res.status(200).json(suggestions);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Unified mode: Search lightweight historical first, use Danbooru as fallback
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
          mode: 'unified-lightweight'
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
        mode: 'unified-lightweight'
      });
    }

    // Historical only
    if (mode === 'historical') {
      const data = searchHistorical(tags, pageNum, limitNum);
      return res.status(200).json({
        posts: data.results,
        total: data.total,
        page: pageNum,
        source: 'historical-lightweight'
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
      source: 'historical-lightweight'
    });

  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
}