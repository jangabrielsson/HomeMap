# Authentication Protection

This document describes the authentication failure protection mechanism implemented in HomeMap to prevent HC3 account lockouts.

## Problem

HC3 locks user accounts after 4 consecutive failed authentication attempts. If HomeMap has incorrect credentials configured, it could make multiple API calls in quick succession:
- Initial connection test
- Event polling requests (every 30-60 seconds)
- Device status updates (multiple devices)
- User-initiated actions

This could quickly exhaust the 4-attempt limit and lock the user out of their HC3 system.

## Solution

HomeMap implements an authentication lock mechanism that:
1. Tracks failed authentication attempts
2. Stops all API calls after 2 consecutive failures
3. Shows a clear error message to the user
4. Prevents further attempts until credentials are updated

## Implementation

### Components

#### 1. HC3ApiManager - Auth Lock State

**File**: `src/modules/hc3ApiManager.js`

**Properties**:
- `authLocked` (boolean) - Flag indicating if auth is locked
- `authFailureCount` (number) - Counter for consecutive failures

**Methods**:

```javascript
isAuthLocked()
// Returns: boolean
// Check if authentication is currently locked

resetAuthLock()
// Resets the lock and failure counter
// Call when credentials are updated

handleAuthFailure(statusCode)
// statusCode: 401 or 403
// Increments failure count
// Locks auth after 2 failures
// Stops event polling
// Shows error dialog to user
```

#### 2. Protection Points

All HC3 API calls check auth lock status and handle failures:

**a) testConnection()**
- Checks `authLocked` before attempting connection
- Resets failure count on successful connection
- Calls `handleAuthFailure()` on 401/403 responses

**b) executeAction()**
- Checks `authLocked` before executing actions
- Throws error if locked
- Calls `handleAuthFailure()` on 401/403 responses

**c) updateDeviceIcon()**
- Silently returns if `authLocked`
- Calls `handleAuthFailure()` on 401/403 responses
- Stops processing further devices

**d) Event Polling** (`eventManager.js`)
- Checks `authLocked` at start of each poll cycle
- Stops polling on auth lock
- Calls `handleAuthFailure()` on 401/403 responses

#### 3. Lock Reset

**File**: `src/script.js`

The `saveSettings()` method calls `resetAuthLock()` when credentials are updated:

```javascript
async saveSettings() {
    // ... save settings ...
    
    // Reset auth lock when credentials are updated
    this.hc3ApiManager.resetAuthLock();
    
    // ... prompt for restart ...
}
```

## User Experience

### Normal Operation
1. User enters credentials
2. App connects successfully
3. All API calls work normally
4. Failure count remains at 0

**When wrong credentials entered**:
1. App attempts connection → Failure #1
2. Event polling tries → Failure #2
3. **Lock triggers**: Dialog appears, polling stops, all API blocked

### Dialog Message
```
Authentication failed after multiple attempts. 
HC3 may lock your account after too many failed attempts.

Please check your username and password in Settings, 
then reload the application.
```

### Recovery Process
1. User clicks Settings
2. User corrects credentials
3. User saves settings
4. Auth lock resets automatically
5. User restarts app (as prompted)
6. Connection works with new credentials

## Technical Details

### Why 2 Attempts?

HC3 locks after 4 failures. We lock after 2 to stay safely away from the limit:
- Attempt 1: Initial connection test
- Attempt 2: Event polling or device update
- **Lock before attempt 3**

This provides a safe margin and prevents the HC3 lockout.

### HTTP Status Codes

The system detects authentication failures by checking for:
- **401 Unauthorized**: Invalid credentials
- **403 Forbidden**: Insufficient permissions

Both trigger the same auth failure handling.

### Thread Safety

The lock is a simple boolean flag checked before each API call. Since JavaScript is single-threaded, no synchronization is needed.

### Edge Cases

**Multiple simultaneous API calls**:
- If multiple calls fail simultaneously, each increments the counter
- The first to reach 2 triggers the lock
- Subsequent calls see `authLocked=true` and skip

**Network errors vs auth errors**:
- Network errors (timeout, connection refused) don't increment failure count
- Only 401/403 responses count as auth failures

**Partial success**:
- Any successful API call resets failure count to 0
- This handles intermittent network issues

## Testing

### Manual Test Cases

**Test 1: Wrong Password**
1. Configure with incorrect password
2. Start app
3. Verify: After 2 failures, auth locks
4. Verify: Error dialog appears
5. Verify: Event polling stops
6. Verify: Status shows "Authentication Failed"

**Test 2: Credential Update**
1. While locked, open Settings
2. Update credentials
3. Save settings
4. Verify: Lock resets
5. Restart app
6. Verify: Connection successful

**Test 3: Mixed Results**
1. Configure with wrong password
2. Start app → 2 failures
3. Update to correct password
4. Save and restart
5. Verify: Connects successfully (counter was reset)

### Console Logging

When auth fails, console shows:
```
Auth failure #1 - HTTP 401
Auth failure #2 - HTTP 401
Auth lock triggered
Event polling stopped
Auth locked, skipping connection test
Auth locked, cannot execute action
```

When credentials updated:
```
Auth lock reset
```

## Future Enhancements

### Potential Improvements

1. **Exponential Backoff**
   - Increase delay between retries
   - Current: Immediate lock after 2
   - Enhanced: 1s, 5s delays before lock

2. **Partial Functionality**
   - Allow read-only mode when locked
   - Show cached device states
   - Block only write operations

3. **Auto-Recovery**
   - Detect when credentials change
   - Auto-retry connection
   - No restart required

4. **User Notification**
   - Show persistent banner when locked
   - Add "Fix Credentials" button directly on banner
   - Better visibility of locked state

5. **Audit Log**
   - Track all auth failures
   - Show timestamp and endpoint
   - Help diagnose issues

## Configuration

Currently no configuration needed. The protection is always active.

If needed in future, could add to settings:
- `auth_failure_threshold` (default: 2)
- `auth_lock_enabled` (default: true)
- `auth_retry_delay` (default: 0)

## Security Considerations

### Not a Security Feature

This is **not** a security mechanism. It's purely to protect the user from accidentally locking their HC3 account.

### No Credential Storage

Credentials are stored in app settings (`.env` or Tauri config). This mechanism doesn't change that.

### No Rate Limiting

This doesn't implement rate limiting. It only prevents repeated failures after credentials are known to be wrong.

## Related Files

- `src/modules/hc3ApiManager.js` - Main implementation
- `src/modules/eventManager.js` - Event polling integration
- `src/script.js` - Settings save integration

## References

- HC3 API Documentation
- HC3 Account Lockout Behavior
- Tauri Dialog API: https://tauri.app/v1/api/js/dialog/

---

**Version**: 1.0  
**Last Updated**: October 30, 2025  
**Author**: HomeMap Development Team
