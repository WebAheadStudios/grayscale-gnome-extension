/**
 * Central type definitions for the Grayscale Toggle extension
 *
 * This file exports all type definitions used throughout the extension,
 * providing a single source of truth for TypeScript interfaces and types.
 */

// Import globals for GNOME Shell types
import './globals.js';

// Core extension types
export * from './extension.js';
export * from './settings.js';
export * from './state.js';
export * from './monitors.js';
export * from './effects.js';
export * from './events.js';
export * from './ui.js';

// Infrastructure types for advanced architectural patterns
export * from './infrastructure.js';
