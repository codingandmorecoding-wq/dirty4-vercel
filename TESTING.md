# Backend Testing Documentation

## Overview

This document describes the testing strategy and implementation for the Vercel backend API. Tests follow Test-Driven Development (TDD) principles to ensure code quality and reliability.

## Test Structure

```
backend-vercel/
├── api/
│   ├── search.js           # Search API implementation
│   └── search.test.js      # Search API tests
├── package.json            # Test configuration and scripts
└── TESTING.md             # This file
```

## Running Tests

### Prerequisites

Install development dependencies:

```bash
npm install
```

### Test Commands

Run all tests:
```bash
npm test
```

Run tests in watch mode (re-runs on file changes):
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

## Test Coverage

Current coverage thresholds are set at 70% for:
- Branch coverage
- Function coverage
- Line coverage
- Statement coverage

Coverage reports are generated in the `coverage/` directory.

## Search API Tests

### Test Categories

#### 1. CORS Headers
Tests ensure proper Cross-Origin Resource Sharing configuration:
- Verifies CORS headers are set on all requests
- Validates OPTIONS preflight request handling

#### 2. Autocomplete Endpoint
Tests for tag autocompletion functionality:
- Returns matching tags for partial queries
- Case-insensitive matching
- Configurable result limits
- Empty results for non-matching queries

#### 3. Historical Search
Tests for historical archive search:
- Single tag search
- Multi-tag search with AND logic
- Pagination support
- Empty result handling
- Case-insensitive tag matching
- Recent images when no tags specified

#### 4. Unified Search Mode
Tests for merged Danbooru and historical results:
- Result merging from multiple sources
- Result interleaving for variety
- Source attribution

#### 5. Error Handling
Tests for graceful error handling:
- Network errors during index loading
- Malformed query parameters
- Invalid page numbers

#### 6. Response Format
Tests for API response structure:
- Proper field names and types
- Pagination metadata
- Source attribution

#### 7. Tag Parsing
Tests for tag processing:
- Whitespace handling
- Empty tag strings
- Case-insensitive matching

## Test Data

Tests use mock data to avoid dependencies on external services:

### Mock Search Index
```javascript
{
  version: '1.0',
  totalImages: 3,
  images: [...],
  tagIndex: {
    'genshin_impact': ['historical_1', 'historical_2', 'historical_3'],
    'lumine': ['historical_1', 'historical_3']
  }
}
```

### Mock Autocomplete Index
```javascript
{
  version: '1.0',
  tags: [
    { tag: 'genshin_impact', count: 3 },
    { tag: 'lumine', count: 2 }
  ]
}
```

## Writing New Tests

### Test Structure

Follow this structure for new tests:

```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup code
  });

  test('should do something specific', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe('expected');
  });

  afterEach(() => {
    // Cleanup code
  });
});
```

### Best Practices

1. **One assertion per test**: Each test should verify one specific behavior
2. **Descriptive test names**: Use "should" statements that describe expected behavior
3. **Arrange-Act-Assert pattern**: Structure tests with clear setup, execution, and verification
4. **Isolation**: Tests should not depend on each other
5. **Mock external dependencies**: Use mocks for network requests, file system, etc.

## Continuous Integration

Tests should be run:
- Before committing code
- In pull request checks
- Before deployment to production

## Troubleshooting

### Common Issues

**Tests fail with "Cannot find module"**
- Ensure `npm install` has been run
- Check that file paths use correct import syntax for ES modules

**Coverage thresholds not met**
- Add tests for uncovered branches
- Review coverage report in `coverage/lcov-report/index.html`

**Tests timeout**
- Increase timeout in jest configuration
- Check for unresolved promises in async tests

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [TDD Principles](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
