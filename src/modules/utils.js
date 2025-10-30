// Utility functions and constants

export const APP_VERSION = "0.1.4";
export const MIN_WIDGET_VERSION = "0.1.5"; // Minimum compatible widget version

/**
 * Compare semantic versions (major.minor.patch)
 * Returns true if widgetVersion is compatible with minVersion
 */
export function isVersionCompatible(widgetVersion, minVersion) {
    const parseVersion = (v) => v.split('.').map(n => parseInt(n) || 0);
    const [wMajor, wMinor, wPatch] = parseVersion(widgetVersion);
    const [mMajor, mMinor, mPatch] = parseVersion(minVersion);
    
    // Major version must match
    if (wMajor !== mMajor) return false;
    
    // Minor version must be >= min
    if (wMinor < mMinor) return false;
    if (wMinor > mMinor) return true;
    
    // Patch version must be >= min
    return wPatch >= mPatch;
}

/**
 * Get property value from nested object using dot notation path
 * Example: getPropertyValue({a: {b: 5}}, "a.b") returns 5
 */
export function getPropertyValue(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

/**
 * Format time ago string (e.g., "2 hours ago")
 */
export function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() / 1000) - timestamp);
    
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}
