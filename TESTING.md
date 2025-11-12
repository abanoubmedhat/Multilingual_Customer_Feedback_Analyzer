# 🧪 Testing Documentation

## Overview

This document provides comprehensive information about the testing strategy, test coverage, and how to run tests for the Feedback Analyzer application.

---

## Test Strategy

The project follows a **comprehensive unit testing approach** with:

- **Backend**: pytest with async support for FastAPI endpoints
- **Frontend**: Vitest + React Testing Library for component testing
- **Mocking**: Gemini AI calls, database operations, and HTTP requests
- **Coverage**: Focus on critical paths (authentication, CRUD, user interactions)

---

## Backend Tests (pytest)

### Setup

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run tests
pytest

# With coverage
pytest --cov=. --cov-report=html
```

### Test Structure

```
backend/tests/
├── __init__.py
├── conftest.py              # Fixtures and test configuration
├── test_auth.py             # Authentication tests
├── test_feedback.py         # Feedback CRUD tests
├── test_products.py         # Product management tests
└── test_rate_limiting.py    # Rate limit tests
```

### Test Coverage

#### Authentication (`test_auth.py`) - 15 tests

✅ **Login Flow**
- Successful login with valid credentials
- Failed login with invalid credentials
- Failed login with non-existent user

✅ **JWT Token Management**
- Token contains correct claims (sub, role, exp, iat)
- Expired tokens are rejected
- Invalid tokens are rejected
- Missing tokens are rejected

✅ **Password Management**
- Successful password change
- Failed password change with wrong current password
- Password change requires authentication

✅ **Authorization**
- Admin-only endpoints require admin role
- Non-admin users are denied access

#### Feedback API (`test_feedback.py`) - 18 tests

✅ **Feedback Creation**
- Successful feedback creation with Gemini mocking
- Feedback creation with pre-analyzed data (no Gemini call)
- Unknown product rejection
- Feedback without product (optional field)

✅ **Translation Endpoint**
- Translate-only without database save

✅ **Feedback Retrieval**
- Authentication required for retrieval
- Get all feedback with pagination
- Filter by product
- Filter by language
- Filter by sentiment

✅ **Feedback Deletion**
- Delete single feedback by ID
- Delete non-existent feedback (404 error)
- Bulk delete multiple entries
- Delete all filtered feedback

✅ **Statistics**
- Get sentiment statistics
- Get stats with filters
- Stats require authentication

#### Product Management (`test_products.py`) - 6 tests

✅ **Product Operations**
- List products (no auth required)
- Create product (auth required)
- Create duplicate product (error handling)
- Delete product
- Delete non-existent product

#### Rate Limiting (`test_rate_limiting.py`) - 2 tests

✅ **API Protection**
- Translate endpoint rate limit (30/min)
- Feedback endpoint rate limit (10/min)

### Running Backend Tests

```bash
# All tests
docker-compose exec backend pytest

# Specific test file
docker-compose exec backend pytest tests/test_auth.py

# Specific test function
docker-compose exec backend pytest tests/test_auth.py::test_login_success

# With coverage report
docker-compose exec backend pytest --cov=. --cov-report=term-missing

# Generate HTML coverage report
docker-compose exec backend pytest --cov=. --cov-report=html
# View at backend/htmlcov/index.html

# Verbose output
docker-compose exec backend pytest -v

# Stop on first failure
docker-compose exec backend pytest -x
```

### Key Testing Patterns

**1. Async Testing**
```python
@pytest.mark.asyncio
async def test_example(client: AsyncClient):
    response = await client.get("/api/endpoint")
    assert response.status_code == 200
```

**2. Mocking Gemini API**
```python
with patch("main._call_gemini_analysis", return_value=mock_response):
    response = await client.post("/api/feedback", json=data)
```

**3. Database Fixtures**
```python
async def test_with_sample_data(db_session, sample_feedback):
    # sample_feedback is automatically created and cleaned up
    assert sample_feedback.id is not None
```

---

## Frontend Tests (Vitest + React Testing Library)

### Setup

```bash
# Install dependencies
cd frontend
npm install

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Test Structure

```
frontend/src/tests/
├── setup.js                 # Test environment setup
├── App.test.jsx             # Main app tests
├── Submit.test.jsx          # Submit form tests
├── Dashboard.test.jsx       # Dashboard tests
└── fetchWithAuth.test.js    # Auth utility tests
```

### Test Coverage

#### App Component (`App.test.jsx`) - 8 tests

✅ **Initial Rendering**
- Renders submit tab for non-authenticated users
- Shows admin login button

✅ **Authentication Flow**
- Loads dashboard with valid JWT token
- Login form submission
- Login failure with error message
- Logout functionality

✅ **Navigation**
- Tab switching (Dashboard, Submit, Settings)
- Session expiry notification

#### Submit Form (`Submit.test.jsx`) - 12 tests

✅ **Form Rendering**
- Form elements render correctly
- Products displayed in dropdown
- Loading state for products

✅ **Validation**
- Error when submitting without text
- Error when submitting without product selection
- Character count display
- Max character limit enforcement

✅ **Submission Process**
- Two-phase submission (analyze → save)
- Elapsed time display
- Cancellation support
- API error handling

#### Dashboard (`Dashboard.test.jsx`) - 13 tests

✅ **Data Display**
- Loading state
- Sentiment statistics display
- Empty state when no feedback
- Feedback list with pagination

✅ **Filtering**
- Filter by product
- Filter by language
- Clear filters

✅ **Pagination**
- Page navigation (prev/next)
- Page size selection
- Page counter display

✅ **CRUD Operations**
- Delete single feedback
- Bulk delete
- Confirmation modal

✅ **User Interactions**
- Show/hide translated text toggle
- Refresh data button

#### Auth Utility (`fetchWithAuth.test.js`) - 6 tests

✅ **Token Management**
- Include Authorization header
- Token refresh on X-New-Token header
- Auto-logout on 401 error

✅ **Request Handling**
- Merge custom headers
- Work without token (public requests)

### Running Frontend Tests

```bash
# All tests
docker-compose exec frontend npm test

# Watch mode (interactive)
docker-compose exec frontend npm run test:watch

# With coverage
docker-compose exec frontend npm run test:coverage

# View coverage report
# Open frontend/coverage/index.html
```

### Key Testing Patterns

**1. Component Rendering**
```javascript
it('renders correctly', () => {
  render(<Component />)
  expect(screen.getByText('Hello')).toBeInTheDocument()
})
```

**2. User Interactions**
```javascript
it('handles button click', async () => {
  const user = userEvent.setup()
  render(<Component />)
  
  await user.click(screen.getByRole('button'))
  
  expect(screen.getByText('Clicked')).toBeInTheDocument()
})
```

**3. Async Operations**
```javascript
it('loads data', async () => {
  render(<Component />)
  
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument()
  })
})
```

**4. Mocking Fetch**
```javascript
global.fetch.mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'test' }),
  })
)
```

---

## Test Scripts

### Quick Test Commands

```bash
# Run all tests (backend + frontend)
./run_tests.sh          # Linux/Mac
.\run_tests.ps1         # Windows PowerShell

# Backend only
docker-compose exec backend pytest -v

# Frontend only
docker-compose exec frontend npm test

# Coverage reports
docker-compose exec backend pytest --cov=. --cov-report=html
docker-compose exec frontend npm run test:coverage
```

---

## Continuous Integration

For CI/CD pipelines (GitHub Actions example):

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and test backend
        run: |
          docker-compose up -d backend db
          docker-compose exec -T backend pytest --cov=. --cov-report=xml
      
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and test frontend
        run: |
          docker-compose up -d frontend
          docker-compose exec -T frontend npm test
```

---

## Test Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| Backend API | 80% | ~75% |
| Frontend Components | 70% | ~75% |
| Critical Paths | 100% | ~95% |

**Critical Paths Include:**
- Authentication flow
- Feedback submission
- Data retrieval and filtering
- Admin operations

---

## Known Test Limitations

1. **Gemini API**: Mocked in tests (no actual API calls)
2. **Database**: In-memory SQLite for backend tests (PostgreSQL in production)
3. **Real-time Features**: Timer accuracy may vary in test environment
4. **Browser Events**: Some browser-specific behaviors are simulated

---

## Adding New Tests

### Backend Test Template

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_new_feature(client: AsyncClient, admin_token):
    """Test description."""
    response = await client.get(
        "/api/new-endpoint",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "expected_field" in data
```

### Frontend Test Template

```javascript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('does something', async () => {
    const user = userEvent.setup()
    render(<MyComponent />)
    
    await user.click(screen.getByRole('button'))
    
    await waitFor(() => {
      expect(screen.getByText('Result')).toBeInTheDocument()
    })
  })
})
```

---

## Troubleshooting

### Backend Tests Fail to Connect to Database

```bash
# Ensure db service is running
docker-compose up -d db

# Check database logs
docker-compose logs db
```

### Frontend Tests Timeout

```bash
# Increase timeout in vitest.config.js
test: {
  testTimeout: 10000
}
```

### Coverage Reports Not Generated

```bash
# Ensure coverage dependencies are installed
pip install pytest-cov  # Backend
npm install --save-dev @vitest/ui  # Frontend
```

---

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [React Testing Library](https://testing-library.com/react)
- [Vitest Documentation](https://vitest.dev/)
- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/)
