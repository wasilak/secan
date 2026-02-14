# Running Cerebro - Troubleshooting Guide

## Current Issue

You're seeing a 403 Forbidden error ("Nie masz uprawnień dostępu do żądanego zasobu") when the frontend tries to access the API.

## Diagnostic Steps

### 1. Check Backend Logs

When you run `cargo run` in the `backend` directory, you should see output like:

```
Cerebro - Elasticsearch Web Administration Tool
Starting backend server...
Configuration loaded successfully
Server will listen on 127.0.0.1:8080
Authentication mode: Open
Configured clusters: 1
...
Server listening on 127.0.0.1:8080
```

### 2. Test API Directly

Open a new terminal and test the API directly with curl:

```bash
# Test health endpoint (should work)
curl http://127.0.0.1:8080/health

# Test clusters endpoint (this is what's failing)
curl http://127.0.0.1:8080/api/clusters
```

### 3. Check Browser Console

In your browser's developer console (F12), check:
- Network tab: What's the actual URL being requested?
- Console tab: Are there any CORS errors?
- What's the exact HTTP status code? (should be visible in Network tab)

## Likely Causes

### Cause 1: Authentication Middleware Applied Incorrectly

The backend might be applying authentication middleware to the `/api/clusters` route even though it's configured in "Open" mode.

**Fix**: We need to ensure the authentication middleware is not blocking requests in Open mode.

### Cause 2: CORS Configuration

The CORS middleware might not be configured correctly for localhost.

**Fix**: The CORS is set to `allow_origin(Any)` which should work, but we might need to be more specific.

### Cause 3: Route Order Issue

The static asset fallback might be catching API routes before they reach the API handlers.

**Fix**: Ensure API routes are registered before the fallback.

## Quick Fix to Try

Let me check the authentication middleware configuration...
