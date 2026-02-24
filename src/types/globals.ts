/**
 * GNOME Shell global type declarations
 * Note: This file supplements ambient types with additional declarations
 */

// Only extend globals that aren't already declared in ambient types
declare global {
    // Additional GNOME Shell globals that might not be in @girs packages
    function logError(error: Error | any, prefix?: string): void;
}

export {};
