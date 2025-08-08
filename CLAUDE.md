# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Installation
```bash
# Complete project setup (recommended for new environments)
make setup
# or run the setup script directly
./setup.sh

# Install dependencies separately
make install-frontend    # Frontend: npm install
make install-backend     # Backend: pip install in venv
```

### Running the Application
```bash
# Start backend server (FastAPI on port 3001)
make start-backend
# or
cd backend && bash -c "source venv/bin/activate && python main.py"

# Start frontend server (Python HTTP server on port 3000)
make start-frontend
# or
cd frontend && npm run start
```

### Testing
```bash
# Run all tests
make test

# Test specific components
make test-frontend       # Jest tests with jsdom
make test-backend        # pytest tests

# Generate coverage reports
make test-coverage       # Both frontend and backend coverage
```

### Code Quality
```bash
# Run linting
make lint                # ESLint + flake8
make lint-frontend       # ESLint only
make lint-backend        # flake8 only

# Format code
make format              # Prettier + black + isort
make format-frontend     # Prettier for JS/CSS/HTML
make format-backend      # black + isort for Python
```

### Utility Commands
```bash
make clean               # Remove temporary files and caches
make help                # Show all available commands
make pre-deploy          # Run clean + lint + test (deployment check)
make reset               # Complete environment reset
```

## Architecture Overview

### Application Structure
This is a **book barcode scanner web application** with a clear separation between frontend and backend:

**Frontend (Vanilla JavaScript + ES6 Modules):**
- `app.js` - Main application controller, manages state and UI
- `scanner.js` - Camera-based barcode scanning using ZXing-js
- `bookApi.js` - API communication layer (Google Books API + backend)
- `export.js` - Data export functionality (Excel/CSV using SheetJS)

**Backend (Python FastAPI):**
- `main.py` - FastAPI application with CORS, error handling, and API endpoints
- `api/amazon.py` - Amazon price scraping (web scraping approach)

### Key Technical Patterns

**Frontend Architecture:**
- ES6 modules with explicit imports/exports
- Class-based components with clear separation of concerns
- LocalStorage for client-side data persistence
- Event-driven architecture with callback handling
- Responsive design with mobile camera support

**Backend Architecture:**
- FastAPI with async/await patterns
- Pydantic models for request/response validation
- Environment variable configuration with python-dotenv
- Structured logging with configurable levels
- CORS middleware for cross-origin requests

**API Integration:**
- Google Books API for book metadata (title, author, publisher, etc.)
- Amazon web scraping for used book prices (with rate limiting)
- RESTful endpoints with proper HTTP status codes

### Data Flow
1. User scans barcode or manually inputs ISBN
2. Frontend validates ISBN format and checks for duplicates
3. Google Books API fetched for book metadata
4. Backend API called for Amazon pricing (if available)
5. Book data stored in LocalStorage and displayed in UI
6. Export functionality allows CSV/Excel download

## Environment Configuration

### Required Environment Variables (.env)
```bash
# Amazon scraping (optional - graceful fallback if not available)
AMAZON_ACCESS_KEY_ID=your_key_here
AMAZON_SECRET_ACCESS_KEY=your_secret_here
AMAZON_ASSOCIATE_TAG=your_tag_here

# FastAPI configuration
FASTAPI_HOST=127.0.0.1
FASTAPI_PORT=3001
FASTAPI_DEBUG=True

# CORS settings
ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000

# Logging
LOG_LEVEL=INFO
```

## Testing Configuration

### Frontend Testing (Jest)
- Test environment: `jsdom` for browser API simulation
- Babel configuration for ES6 module transformation
- Test files: `frontend/tests/unit/**/*.test.js`
- Coverage collection from `frontend/js/**/*.js`

### Backend Testing (pytest)
- Async testing with `pytest-asyncio`
- Test files: `backend/tests/**/*.py`
- Coverage reporting with `--cov` flag

## Development Notes

### Shell Compatibility
The Makefile uses `bash -c` commands to ensure compatibility across different shell environments, avoiding common issues with `source` command in `/bin/sh`.

### Port Configuration
- Frontend: Port 3000 (Python HTTP server)
- Backend: Port 3001 (FastAPI with Uvicorn)
- Both ports are configurable via environment variables

### Important Implementation Details

**Barcode Scanning:**
- Requires HTTPS for camera access in browsers
- Uses ZXing-js library for ISBN barcode detection
- Supports both ISBN-10 and ISBN-13 formats

**Amazon Price Scraping:**
- Uses web scraping (not official API) - be mindful of rate limits
- Implements random delays and user-agent rotation
- Graceful fallback when pricing unavailable
- Production usage should consider Amazon Product Advertising API

**Data Persistence:**
- Client-side only (LocalStorage)
- No server-side database
- Export functionality for data backup

### Performance Considerations
- Image lazy loading for book thumbnails
- Rate limiting on Amazon price requests
- Client-side data validation before API calls
- Responsive design optimized for mobile scanning