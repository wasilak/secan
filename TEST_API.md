# API Testing Guide

## Test the Backend API Directly

### 1. Start the Backend

```bash
cd backend
cargo run
```

Wait for the message: `Server listening on 127.0.0.1:8080`

### 2. Test with curl (in a new terminal)

```bash
# Test health endpoint
curl http://127.0.0.1:8080/health
# Expected: {"status":"ok"}

# Test clusters endpoint  
curl http://127.0.0.1:8080/api/clusters
# Expected: [{"id":"local","name":"Local Development","nodes":["http://localhost:9200"]}]

# Test if static assets are served
curl http://127.0.0.1:8080/
# Expected: HTML content (the index.html file)
```

### 3. Test in Browser

Open your browser and try these URLs:

1. `http://localhost:8080/health` - Should show `{"status":"ok"}`
2. `http://localhost:8080/api/clusters` - Should show JSON with cluster info
3. `http://localhost:8080/` - Should show the Cerebro UI

### 4. Check Browser Console

If you see errors:

**If you see CORS errors:**
- The backend CORS is set to allow any origin, so this shouldn't happen
- But if it does, we need to adjust the CORS configuration

**If you see 403 Forbidden:**
- Check if it's coming from the backend or the browser
- Look at the Response Headers in the Network tab
- If the response has `server: axum`, it's from our backend
- If not, it might be a browser security policy

**If you see "Failed to fetch" or network errors:**
- Make sure the backend is actually running
- Check if you can access `http://localhost:8080/health` directly in the browser

### 5. Common Issues

**Issue: "Nie masz uprawnień" (No permission)**

This Polish error message suggests it might be:
1. A browser security policy blocking the request
2. An antivirus or firewall blocking localhost connections
3. The backend returning 403 (but our code doesn't do this in Open mode)

**Solution:**
- Try accessing via `http://localhost:8080` instead of `http://127.0.0.1:8080`
- Check your browser's security settings
- Try a different browser
- Check if any security software is blocking the connection

**Issue: API requests go to wrong URL**

The frontend is configured to make requests to `/api/*` which should work when served from the same origin.

If the frontend is loaded from `http://localhost:8080`, API requests should go to:
- `http://localhost:8080/api/clusters`
- `http://localhost:8080/api/auth/login`
- etc.

## Next Steps

Please run the curl tests above and let me know:
1. Do the curl commands work?
2. What do you see in the browser console?
3. What's the exact URL you're accessing in the browser?
4. Are you using any security software or browser extensions that might block requests?
