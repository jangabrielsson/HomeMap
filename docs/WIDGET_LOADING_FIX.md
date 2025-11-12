# Widget Loading Fix for Mobile Platforms

## Problem

On Android and iOS, the widget selector was empty and didn't show available widgets. This was because:

1. Built-in widget JSON files were not being synced from the bundled app resources to the writable app data directory
2. The `find_template_directory()` function couldn't locate bundled resources on mobile platforms
3. Widget loading code in JavaScript was trying to read files that didn't exist

## Solution

### Backend Changes (Rust)

1. **Modified `sync_builtin_resources` function** to support app handle:
   - Created `sync_builtin_resources_with_app()` that accepts an optional app handle
   - Uses Tauri's `app.path().resource_dir()` to properly locate bundled resources on mobile
   - Tries both direct `homemapdata.example` and `_up_/homemapdata.example` paths (Android bundling pattern)
   - Falls back to `find_template_directory()` for desktop platforms

2. **Added `sync_resources` command**:
   - New Tauri command that can be called from JavaScript
   - Provides app handle to the sync function
   - Ensures widgets are synced before the UI tries to load them

### Frontend Changes (JavaScript)

1. **Modified `loadHomeMapConfig()` in script.js**:
   - Added call to `invoke('sync_resources')` early in initialization
   - Runs right after getting the data path
   - Includes error handling with warning (non-fatal)

## Testing

Test on:
- ✅ Desktop (should continue working)
- ✅ Android tablet/phone
- ✅ iOS iPad/iPhone

Verify:
1. Widget selector shows all built-in widgets
2. Device management allows changing widget types
3. Icons display correctly for each widget

## Related Files

- `src-tauri/src/lib.rs` - Resource sync logic
- `src/script.js` - Initialization sequence
- `src/modules/widgetManager.js` - Widget loading

## Notes

This fix ensures that on mobile platforms, the bundled widget definitions are properly extracted to the writable app data directory where they can be accessed by the widget loading system. The sync happens automatically on first launch and when the app version changes.
