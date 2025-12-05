# Beancount Journal API Backend

This Python backend provides complete transaction data for the Journal tab by parsing Beancount files directly, bypassing BQL limitations.

## Overview

The backend **starts automatically** as a child process when the Journal tab is accessed. No manual setup or script execution is required.

## Features

- **Automatic Process Management**: Starts and stops with the Obsidian plugin
- **Complete Transaction Data**: Full transaction parsing with all postings, metadata, tags, and links
- **Advanced Filtering**: Server-side filtering by date, account, payee, tags, and search terms
- **Real-time Updates**: Reload Beancount files without restarting the server
- **REST API**: Clean JSON API for the Obsidian plugin to consume
- **High Performance**: Direct file parsing for faster data access

## Prerequisites

The backend automatically handles dependency installation, but requires:

- **Python 3.8 or higher** (must be available in system PATH as `python3`, `python`, or `py`)
- **Beancount** package: `pip install beancount`

The backend will automatically install Flask and flask-cors when first started.

## How It Works

1. **Automatic Startup**: When you open the Journal tab, the plugin automatically starts the Python backend
2. **Process Management**: Backend runs as a child process, managed by `BackendManager.ts`
3. **Health Monitoring**: Plugin continuously monitors backend health and restarts if needed
4. **Automatic Cleanup**: Backend stops when you close Obsidian or switch away from Journal tab

## Architecture

### Files
- **`journal_api.py`**: Main Flask application with REST API endpoints
- **`BackendManager.ts`**: TypeScript process manager that handles backend lifecycle
- **`README.md`**: This documentation file

### API Endpoints

The server runs on `http://localhost:5001` and provides these endpoints:

#### Health Check
```
GET /health
```
Returns server status and timestamp.

#### Get Transactions
```
GET /transactions?start_date=2024-01-01&end_date=2024-12-31&account=Assets&limit=100&offset=0
```

**Query Parameters:**
- `start_date`: Filter transactions from this date (YYYY-MM-DD)
- `end_date`: Filter transactions to this date (YYYY-MM-DD)
- `account`: Filter transactions involving this account (partial match)
- `payee`: Filter by payee name (partial match)
- `tag`: Filter by tag name
- `search`: Search in payee, narration, and accounts
- `limit`: Maximum number of transactions to return (default: 100)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "transactions": [...],
  "total_count": 1234,
  "returned_count": 100,
  "offset": 0,
  "limit": 100,
  "has_more": true
}
```

#### Other Endpoints
- `GET /accounts` - Returns all account names
- `GET /payees` - Returns all unique payees
- `GET /tags` - Returns all unique tags
- `GET /statistics` - Returns ledger statistics
- `POST /reload` - Reloads the Beancount file from disk

## Transaction Data Format

Each transaction object contains complete Beancount data:

```json
{
  "id": "2024-01-15_1234567890_2",
  "date": "2024-01-15",
  "flag": "*",
  "payee": "Grocery Store",
  "narration": "Weekly groceries",
  "tags": ["food", "weekly"],
  "links": [],
  "postings": [
    {
      "account": "Expenses:Food:Groceries",
      "amount": "85.50",
      "currency": "USD",
      "price": null,
      "cost": null
    },
    {
      "account": "Assets:Checking",
      "amount": "-85.50",
      "currency": "USD",
      "price": null,
      "cost": null
    }
  ],
  "metadata": {
    "filename": "/path/to/file.beancount",
    "lineno": 123
  }
}
```

## Troubleshooting

### Common Issues

1. **"Backend API Starting..." persists**
   - Check that Python 3.8+ is installed and in PATH
   - Verify beancount is installed: `pip install beancount`
   - Check Obsidian's Developer Console (Ctrl+Shift+I) for error messages

2. **"Failed to start Python backend"**
   - Ensure Python command works: `python --version` or `python3 --version`
   - Install missing dependencies: `pip install beancount flask flask-cors`
   - Verify Beancount file path is correct in plugin settings

3. **Backend stops unexpectedly**
   - Check Developer Console for Python error messages
   - Verify Beancount file syntax: `bean-check /path/to/file.beancount`
   - Try reloading the plugin or restarting Obsidian

### Logs and Debugging

- Backend output is logged to Obsidian's Developer Console
- Python errors appear in the console stderr output
- The plugin automatically retries failed backend starts up to 3 times

## Development

For backend development:

1. **Direct Testing**: Run `python journal_api.py /path/to/file.beancount` for standalone testing
2. **API Testing**: Use curl or Postman to test endpoints
3. **Plugin Integration**: Backend manager handles all process lifecycle automatically

### Manual Startup (Development Only)

For debugging purposes, you can run the backend manually:

```bash
cd src/backend
python journal_api.py "/path/to/your/file.beancount" --port 5001 --debug
```

The plugin will detect and use the existing backend instance.

## Integration with Obsidian Plugin

The Journal tab automatically:

- **Starts Backend**: Launches Python process when needed
- **Monitors Health**: Continuously checks backend status
- **Handles Errors**: Shows clear error messages and retry options
- **Manages Lifecycle**: Stops backend when plugin closes
- **Provides UI**: Real-time connection status and backend controls

No user intervention required - everything is automatic!