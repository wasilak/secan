# API Validation Strategy

## Overview

This document describes the validation strategy for the Secan frontend-backend integration.

## Current Architecture

### Backend Validation (Primary)

The backend is the source of truth for validation:

1. **Request Validation**: All API requests are validated on the backend using:
   - Serde for JSON deserialization with strict parsing
   - utoipa for OpenAPI schema definition
   - Custom validation in handlers (e.g., cluster ID format, pagination limits)

2. **Response Validation**: Backend ensures all responses conform to OpenAPI schemas defined with utoipa

3. **Error Responses**: All endpoints return consistent error responses defined in OpenAPI:
   ```typescript
   interface ApiError {
     error: string;    // Error code (e.g., "cluster_not_found")
     message: string; // Human-readable message
   }
   ```

### Frontend Validation (Secondary)

The frontend uses TypeScript for compile-time validation:

1. **TypeScript Types**: Manually maintained in `src/types/api.ts` (828 lines)
   - Aligned with backend types
   - Updated when new API endpoints are added

2. **Runtime Validation**: Not currently enforced with Zod
   - Backend is trusted to return valid data
   - TypeScript provides compile-time safety

3. **API Client Error Handling**:
   - `src/api/client.ts` - Axios client with retry logic
   - Consistent error handling for all endpoints
   - Automatic retry for transient errors (5xx, 429, network errors)

## Validation Flow

```
User Input → Frontend TypeScript → API Request → Backend Validation
                                                            ↓
                                                      Valid? 
                                                       /   \
                                                    Yes    No
                                                      ↓     ↓
                                              Response    4xx Error
                                                    ↓
                                          Frontend TypeScript Types
                                                    ↓
                                              UI Render
```

## Error Handling

### Backend Errors

All API errors follow this structure:
```typescript
interface ApiError {
  error: string;    // Machine-readable error code
  message: string; // Human-readable message
}
```

### Frontend Error Categories

1. **Retryable Errors** (auto-retry with backoff):
   - Network errors
   - 5xx server errors
   - 408 Request Timeout
   - 429 Too Many Requests

2. **Non-Retryable Errors** (show to user):
   - 400 Bad Request (validation error)
   - 401 Unauthorized (redirect to login)
   - 403 Forbidden (show permission error)
   - 404 Not Found (show not found error)

## Best Practices

### Adding New API Endpoints

1. **Backend**: Add handler with utoipa annotations
   - Define request/response types with `ToSchema`
   - Add validation in handler
   - Document in OpenAPI spec

2. **Frontend**: 
   - Add TypeScript types to `src/types/api.ts`
   - Add API method to `src/api/client.ts`
   - Use existing error handling pattern

### Validation Guidelines

1. **Trust but Verify**: Backend validates all input; frontend can do basic validation for UX
2. **Fail Gracefully**: Show user-friendly error messages
3. **Log Errors**: Console log errors for debugging
4. **Retry Transient**: Auto-retry network/5xx errors
5. **No Validation Libraries**: Currently no Zod runtime validation needed

## Future Improvements

1. **Zod Runtime Validation**: Could add for critical responses
2. **OpenAPI Code Generation**: When utoipa supports generics better
3. **Contract Tests**: Backend-frontend integration tests

## Related Files

- `src/types/api.ts` - Frontend TypeScript types
- `src/api/client.ts` - API client with error handling
- `openapi.json` - OpenAPI specification
- `src/routes/` - Backend handlers with validation
