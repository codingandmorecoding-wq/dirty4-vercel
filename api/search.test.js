/**
 * Test Suite: Search API
 *
 * Tests the unified search API that merges Danbooru and Historical archive results.
 * Follows TDD principles with comprehensive coverage of all API endpoints and edge cases.
 *
 * @module api/search.test
 */

import { jest } from '@jest/globals';

/**
 * Mock fetch for R2 index loading
 */
global.fetch = jest.fn();

/**
 * Mock search index data for testing
 */
const mockSearchIndex = {
  version: '1.0',
  totalImages: 3,
  images: [
    {
      id: 'historical_1',
      fileUrl: 'https://r2.dev/images/historical_1.jpg',
      thumbnailUrl: 'https://r2.dev/thumbnails/historical_1.jpg',
      tags: ['genshin_impact', 'lumine', 'rating:safe']
    },
    {
      id: 'historical_2',
      fileUrl: 'https://r2.dev/images/historical_2.jpg',
      thumbnailUrl: 'https://r2.dev/thumbnails/historical_2.jpg',
      tags: ['genshin_impact', 'paimon', 'rating:safe']
    },
    {
      id: 'historical_3',
      fileUrl: 'https://r2.dev/images/historical_3.mp4',
      thumbnailUrl: 'https://r2.dev/thumbnails/historical_3.jpg',
      tags: ['genshin_impact', 'lumine', 'paimon', 'rating:safe']
    }
  ],
  tagIndex: {
    'genshin_impact': ['historical_1', 'historical_2', 'historical_3'],
    'lumine': ['historical_1', 'historical_3'],
    'paimon': ['historical_2', 'historical_3'],
    'rating:safe': ['historical_1', 'historical_2', 'historical_3']
  }
};

const mockAutocompleteIndex = {
  version: '1.0',
  tags: [
    { tag: 'genshin_impact', count: 3 },
    { tag: 'lumine', count: 2 },
    { tag: 'paimon', count: 2 }
  ]
};

describe('Search API', () => {
  let handler;
  let mockRequest;
  let mockResponse;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock fetch responses for index loading
    global.fetch.mockImplementation((url) => {
      if (url.includes('search-index.json')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockSearchIndex)
        });
      }
      if (url.includes('autocomplete')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockAutocompleteIndex)
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    // Import handler after mocks are set up
    const module = await import('./search.js');
    handler = module.default;

    // Setup mock request and response
    mockRequest = {
      method: 'GET',
      query: {}
    };

    mockResponse = {
      statusCode: null,
      headers: {},
      body: null,
      setHeader: jest.fn(function(key, value) {
        this.headers[key] = value;
        return this;
      }),
      status: jest.fn(function(code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(function(data) {
        this.body = data;
        return this;
      }),
      end: jest.fn()
    };
  });

  describe('CORS Headers', () => {
    test('should set CORS headers on all requests', async () => {
      await handler(mockRequest, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, OPTIONS');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type');
    });

    test('should handle OPTIONS preflight requests', async () => {
      mockRequest.method = 'OPTIONS';

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });

  describe('Autocomplete Endpoint', () => {
    test('should return matching tags for autocomplete query', async () => {
      mockRequest.query = { autocomplete: 'gensh' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.suggestions).toBeDefined();
      expect(mockResponse.body.suggestions[0].name).toBe('genshin_impact');
      expect(mockResponse.body.suggestions[0].post_count).toBe(3);
    });

    test('should return empty array for no matches', async () => {
      mockRequest.query = { autocomplete: 'nonexistent' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.suggestions).toEqual([]);
    });

    test('should limit autocomplete results to specified limit', async () => {
      mockRequest.query = { autocomplete: 'g', limit: '1' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.body.suggestions.length).toBeLessThanOrEqual(1);
    });

    test('should be case-insensitive', async () => {
      mockRequest.query = { autocomplete: 'GENSH' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.body.suggestions.length).toBeGreaterThan(0);
      expect(mockResponse.body.suggestions[0].name).toBe('genshin_impact');
    });
  });

  describe('Historical Search', () => {
    test('should return results for single tag search', async () => {
      mockRequest.query = { tags: 'lumine', mode: 'historical' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.posts).toBeDefined();
      expect(mockResponse.body.posts.length).toBe(2);
      expect(mockResponse.body.total).toBe(2);
      expect(mockResponse.body.source).toBe('historical');
    });

    test('should return results for multiple tag search with AND logic', async () => {
      mockRequest.query = { tags: 'lumine paimon', mode: 'historical' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.posts.length).toBe(1);
      expect(mockResponse.body.posts[0].id).toBe('historical_3');
    });

    test('should return empty results for non-matching tags', async () => {
      mockRequest.query = { tags: 'nonexistent', mode: 'historical' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.posts).toEqual([]);
      expect(mockResponse.body.total).toBe(0);
    });

    test('should paginate results correctly', async () => {
      mockRequest.query = { tags: 'genshin_impact', mode: 'historical', page: '1', limit: '2' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.posts.length).toBe(2);
      expect(mockResponse.body.page).toBe(1);
    });

    test('should handle invalid page numbers gracefully', async () => {
      mockRequest.query = { tags: 'genshin_impact', mode: 'historical', page: 'invalid' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.page).toBe(1);
    });

    test('should return recent images when no tags specified', async () => {
      mockRequest.query = { mode: 'historical' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.posts).toBeDefined();
      expect(mockResponse.body.total).toBeGreaterThan(0);
    });
  });

  describe('Unified Search Mode', () => {
    test('should merge historical and danbooru results', async () => {
      mockRequest.query = { tags: 'lumine', mode: 'unified' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.mode).toBe('unified');
      expect(mockResponse.body.sources).toBeDefined();
      expect(mockResponse.body.sources.historical).toBeDefined();
    });

    test('should interleave results from multiple sources', async () => {
      mockRequest.query = { tags: 'genshin_impact', mode: 'unified' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.body.posts).toBeDefined();
      const sources = mockResponse.body.posts.map(p => p.source);
      expect(sources).toContain('historical');
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const newModule = await import('./search.js?t=' + Date.now());
      const newHandler = newModule.default;

      await newHandler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalled();
    });

    test('should handle malformed query parameters', async () => {
      mockRequest.query = { limit: 'not-a-number', page: 'also-not-a-number' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Response Format', () => {
    test('should return properly formatted historical results', async () => {
      mockRequest.query = { tags: 'lumine', mode: 'historical' };

      await handler(mockRequest, mockResponse);

      const post = mockResponse.body.posts[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('file_url');
      expect(post).toHaveProperty('preview_url');
      expect(post).toHaveProperty('tag_string');
      expect(post).toHaveProperty('source');
      expect(post.source).toBe('historical');
    });

    test('should include pagination metadata', async () => {
      mockRequest.query = { tags: 'genshin_impact', mode: 'historical', page: '2' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.body).toHaveProperty('page');
      expect(mockResponse.body).toHaveProperty('total');
      expect(mockResponse.body.page).toBe(2);
    });
  });

  describe('Tag Parsing', () => {
    test('should handle whitespace in tags', async () => {
      mockRequest.query = { tags: '  lumine   paimon  ', mode: 'historical' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.posts).toBeDefined();
    });

    test('should handle empty tag string', async () => {
      mockRequest.query = { tags: '', mode: 'historical' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.posts).toBeDefined();
    });

    test('should be case-insensitive for tag matching', async () => {
      mockRequest.query = { tags: 'LUMINE', mode: 'historical' };

      await handler(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.body.posts.length).toBeGreaterThan(0);
    });
  });
});
