/**
 * ConfigCache - High-performance settings caching with change notification
 * Optimizes GSettings access with intelligent caching and validation
 */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

// Cache entry metadata
export interface CacheEntry<T = any> {
    key: string;
    value: T;
    type: 'string' | 'boolean' | 'int' | 'double' | 'strv' | 'variant';
    timestamp: number;
    accessCount: number;
    lastAccess: number;
    dirty: boolean;
    validated: boolean;
    validator?: (value: T) => boolean;
    transformer?: (value: any) => T;
}

// Cache configuration
export interface CacheConfig {
    maxEntries?: number;
    maxAge?: number; // milliseconds
    enableValidation?: boolean;
    enableTransformation?: boolean;
    enableStatistics?: boolean;
    autoFlush?: boolean;
    flushInterval?: number;
    preloadKeys?: string[];
    writeThrough?: boolean;
    batchWrites?: boolean;
    batchSize?: number;
}

// Validation rule
export type ValidationRule<T = any> = (value: T) => boolean | string;

// Transformation function
export type TransformFunction<T = any> = (value: any) => T;

// Cache statistics
export interface CacheStatistics {
    totalEntries: number;
    hitRate: number;
    missRate: number;
    accessCount: number;
    validationFailures: number;
    transformationFailures: number;
    flushCount: number;
    memoryUsage: number;
    oldestEntry: number;
    newestEntry: number;
}

// Settings schema information
export interface SchemaInfo {
    id: string;
    path?: string;
    keys: Map<
        string,
        {
            type: string;
            defaultValue: any;
            description?: string;
            range?: { min?: any; max?: any };
            choices?: any[];
        }
    >;
}

// Change notification
export interface SettingChange {
    key: string;
    oldValue: any;
    newValue: any;
    timestamp: number;
    source: 'cache' | 'gsettings' | 'external';
}

export const ConfigCache = GObject.registerClass(
    {
        GTypeName: 'GrayscaleConfigCache',
        Signals: {
            'setting-changed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_VARIANT, GObject.TYPE_VARIANT], // key, oldValue, newValue
            },
            'cache-flushed': {
                param_types: [GObject.TYPE_INT], // entry count
            },
            'validation-failed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_VARIANT], // key, value
            },
            'cache-miss': {
                param_types: [GObject.TYPE_STRING], // key
            },
            'statistics-updated': {
                param_types: [GObject.TYPE_VARIANT], // statistics
            },
        },
    },
    class ConfigCache extends GObject.Object {
        private _settings: Gio.Settings;
        private _config: Required<CacheConfig>;
        private _cache: Map<string, CacheEntry> = new Map();
        private _validators: Map<string, ValidationRule> = new Map();
        private _transformers: Map<string, TransformFunction> = new Map();
        private _schemaInfo: SchemaInfo;
        private _statistics: CacheStatistics;
        private _signalConnections: number[] = [];
        private _flushTimeoutId: number | null = null;
        private _batchBuffer: Map<string, any> = new Map();
        private _logger: any = null;
        private _destroyed = false;

        constructor(settings: Gio.Settings, config: CacheConfig = {}) {
            super();

            this._settings = settings;
            this._config = {
                maxEntries: 1000,
                maxAge: 300000, // 5 minutes
                enableValidation: true,
                enableTransformation: true,
                enableStatistics: true,
                autoFlush: true,
                flushInterval: 60000, // 1 minute
                preloadKeys: [],
                writeThrough: true,
                batchWrites: false,
                batchSize: 10,
                ...config,
            };

            this._statistics = {
                totalEntries: 0,
                hitRate: 0,
                missRate: 0,
                accessCount: 0,
                validationFailures: 0,
                transformationFailures: 0,
                flushCount: 0,
                memoryUsage: 0,
                oldestEntry: Date.now(),
                newestEntry: Date.now(),
            };

            this._initialize();
        }

        // Public API - Getters
        getString(key: string, defaultValue?: string): string {
            return this._getValue(key, 'string', defaultValue, () =>
                this._settings.get_string(key)
            );
        }

        getBoolean(key: string, defaultValue?: boolean): boolean {
            return this._getValue(key, 'boolean', defaultValue, () =>
                this._settings.get_boolean(key)
            );
        }

        getInt(key: string, defaultValue?: number): number {
            return this._getValue(key, 'int', defaultValue, () => this._settings.get_int(key));
        }

        getDouble(key: string, defaultValue?: number): number {
            return this._getValue(key, 'double', defaultValue, () =>
                this._settings.get_double(key)
            );
        }

        getStringArray(key: string, defaultValue?: string[]): string[] {
            return this._getValue(key, 'strv', defaultValue, () => this._settings.get_strv(key));
        }

        getVariant(key: string, defaultValue?: any): any {
            return this._getValue(key, 'variant', defaultValue, () => {
                const variant = this._settings.get_value(key);
                return variant ? variant.unpack() : defaultValue;
            });
        }

        // Public API - Setters
        setString(key: string, value: string): boolean {
            return this._setValue(key, value, 'string', () =>
                this._settings.set_string(key, value)
            );
        }

        setBoolean(key: string, value: boolean): boolean {
            return this._setValue(key, value, 'boolean', () =>
                this._settings.set_boolean(key, value)
            );
        }

        setInt(key: string, value: number): boolean {
            return this._setValue(key, value, 'int', () => this._settings.set_int(key, value));
        }

        setDouble(key: string, value: number): boolean {
            return this._setValue(key, value, 'double', () =>
                this._settings.set_double(key, value)
            );
        }

        setStringArray(key: string, value: string[]): boolean {
            return this._setValue(key, value, 'strv', () => this._settings.set_strv(key, value));
        }

        setVariant(key: string, value: any): boolean {
            return this._setValue(key, value, 'variant', () => {
                const variant = new GLib.Variant('v', new GLib.Variant('s', JSON.stringify(value)));
                this._settings.set_value(key, variant);
            });
        }

        // Validation and transformation
        setValidator(key: string, validator: ValidationRule): void {
            this._validators.set(key, validator);
        }

        setTransformer(key: string, transformer: TransformFunction): void {
            this._transformers.set(key, transformer);
        }

        removeValidator(key: string): void {
            this._validators.delete(key);
        }

        removeTransformer(key: string): void {
            this._transformers.delete(key);
        }

        // Cache management
        invalidate(key: string): boolean {
            const entry = this._cache.get(key);
            if (entry) {
                this._cache.delete(key);
                this._updateStatistics();
                this._log('debug', `Invalidated cache entry for key: ${key}`);
                return true;
            }
            return false;
        }

        invalidateAll(): void {
            const count = this._cache.size;
            this._cache.clear();
            this._updateStatistics();
            this._log('info', `Invalidated all ${count} cache entries`);
        }

        refresh(key: string): boolean {
            this.invalidate(key);
            try {
                // Trigger a fresh load
                this._settings.get_value(key);
                return true;
            } catch (error) {
                this._log('error', `Failed to refresh key ${key}:`, error);
                return false;
            }
        }

        refreshAll(): void {
            this.invalidateAll();
            // Preload configured keys
            for (const key of this._config.preloadKeys) {
                this.refresh(key);
            }
        }

        // Batch operations
        beginBatch(): void {
            this._batchBuffer.clear();
        }

        endBatch(): boolean {
            if (this._batchBuffer.size === 0) {
                return true;
            }

            try {
                this._settings.delay();

                for (const [key, value] of this._batchBuffer) {
                    const entry = this._cache.get(key);
                    if (entry) {
                        this._setGSettingsValue(key, value, entry.type);
                    }
                }

                this._settings.apply();
                this._batchBuffer.clear();

                this._log('debug', `Applied batch update with ${this._batchBuffer.size} changes`);
                return true;
            } catch (error) {
                this._log('error', 'Failed to apply batch update:', error);
                return false;
            }
        }

        // Inspection
        has(key: string): boolean {
            return this._cache.has(key) || this._settings.list_keys().includes(key);
        }

        getCacheEntry(key: string): CacheEntry | null {
            return this._cache.get(key) || null;
        }

        getCachedKeys(): string[] {
            return Array.from(this._cache.keys());
        }

        getStatistics(): CacheStatistics {
            return { ...this._statistics };
        }

        getSchemaInfo(): SchemaInfo {
            return { ...this._schemaInfo };
        }

        // Advanced features
        preload(keys: string[] = this._config.preloadKeys): void {
            this._log('info', `Preloading ${keys.length} settings`);

            for (const key of keys) {
                try {
                    // Access each value to populate cache
                    this._settings.get_value(key);
                } catch (error) {
                    this._log('warn', `Failed to preload key ${key}:`, error);
                }
            }
        }

        flush(): void {
            const staleEntries: string[] = [];
            const now = Date.now();

            for (const [key, entry] of this._cache) {
                const age = now - entry.timestamp;
                if (age > this._config.maxAge) {
                    staleEntries.push(key);
                }
            }

            for (const key of staleEntries) {
                this._cache.delete(key);
            }

            // Trim cache if over max entries
            if (this._cache.size > this._config.maxEntries) {
                const entries = Array.from(this._cache.entries());
                const sortedByAge = entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
                const toRemove = sortedByAge.slice(0, this._cache.size - this._config.maxEntries);

                for (const [key] of toRemove) {
                    this._cache.delete(key);
                }
            }

            this._updateStatistics();
            this.emit('cache-flushed', staleEntries.length);
            this._log('debug', `Flushed ${staleEntries.length} stale cache entries`);
        }

        // Configuration
        updateConfig(config: Partial<CacheConfig>): void {
            this._config = { ...this._config, ...config };

            // Restart flush timer if interval changed
            if (config.flushInterval) {
                this._stopFlushTimer();
                this._startFlushTimer();
            }

            this._log('debug', 'Cache configuration updated', config);
        }

        setLogger(logger: any): void {
            this._logger = logger;
        }

        // Lifecycle
        destroy(): void {
            if (this._destroyed) {
                return;
            }

            this._log('info', 'Destroying ConfigCache...');

            // Disconnect signals
            for (const id of this._signalConnections) {
                this._settings.disconnect(id);
            }
            this._signalConnections = [];

            // Stop timers
            this._stopFlushTimer();

            // Apply any pending batched changes
            this.endBatch();

            // Clear cache
            this._cache.clear();
            this._validators.clear();
            this._transformers.clear();
            this._batchBuffer.clear();

            this._destroyed = true;
            this._log(
                'info',
                `ConfigCache destroyed. Final stats: ${JSON.stringify(this._statistics)}`
            );
        }

        // Private methods
        private _initialize(): void {
            // Load schema information
            this._loadSchemaInfo();

            // Connect to settings changes
            const changedId = this._settings.connect(
                'changed',
                (settings: Gio.Settings, key: string) => {
                    this._handleSettingsChange(key);
                }
            );
            this._signalConnections.push(changedId);

            // Start flush timer
            this._startFlushTimer();

            // Preload configured keys
            if (this._config.preloadKeys.length > 0) {
                this.preload();
            }

            this._log('info', 'ConfigCache initialized', {
                schemaId: this._settings.schema_id,
                maxEntries: this._config.maxEntries,
                preloadKeys: this._config.preloadKeys,
            });
        }

        private _loadSchemaInfo(): void {
            const schema = this._settings.settings_schema;
            const keys = new Map();

            if (schema) {
                for (const key of schema.list_keys()) {
                    const keyInfo = schema.get_key(key);
                    keys.set(key, {
                        type: keyInfo.get_value_type().dup_string(),
                        defaultValue: keyInfo.get_default_value()?.unpack(),
                        description: keyInfo.get_description(),
                    });
                }
            }

            this._schemaInfo = {
                id: this._settings.schema_id,
                path: this._settings.path || undefined,
                keys,
            };
        }

        private _getValue<T>(
            key: string,
            type: CacheEntry['type'],
            defaultValue: T | undefined,
            getter: () => T
        ): T {
            const entry = this._cache.get(key);
            const now = Date.now();

            // Cache hit
            if (entry && !this._isExpired(entry)) {
                entry.lastAccess = now;
                entry.accessCount++;
                this._statistics.accessCount++;
                this._updateHitRate(true);
                return this._transformValue(key, entry.value) as T;
            }

            // Cache miss - load from GSettings
            this.emit('cache-miss', key);
            this._updateHitRate(false);

            try {
                const value = getter();
                const transformedValue = this._transformValue(key, value);
                const validatedValue = this._validateValue(key, transformedValue);

                // Store in cache
                const cacheEntry: CacheEntry<T> = {
                    key,
                    value: validatedValue,
                    type,
                    timestamp: now,
                    accessCount: 1,
                    lastAccess: now,
                    dirty: false,
                    validated: true,
                };

                this._cache.set(key, cacheEntry);
                this._updateStatistics();

                return validatedValue as T;
            } catch (error) {
                this._log('error', `Failed to get value for key ${key}:`, error);
                return defaultValue as T;
            }
        }

        private _setValue<T>(
            key: string,
            value: T,
            type: CacheEntry['type'],
            setter: () => void
        ): boolean {
            try {
                // Validate value
                const validatedValue = this._validateValue(key, value);
                if (validatedValue === null) {
                    return false;
                }

                const now = Date.now();
                const oldEntry = this._cache.get(key);
                const oldValue = oldEntry?.value;

                // Update cache immediately
                const entry: CacheEntry<T> = {
                    key,
                    value: validatedValue,
                    type,
                    timestamp: now,
                    accessCount: (oldEntry?.accessCount || 0) + 1,
                    lastAccess: now,
                    dirty: !this._config.writeThrough,
                    validated: true,
                };

                this._cache.set(key, entry);

                // Handle batching
                if (this._config.batchWrites && this._batchBuffer.size < this._config.batchSize) {
                    this._batchBuffer.set(key, validatedValue);
                } else {
                    // Write through to GSettings
                    if (this._config.writeThrough) {
                        setter();
                        entry.dirty = false;
                    }
                }

                // Emit change event
                this.emit('setting-changed', key, oldValue, validatedValue);
                this._updateStatistics();

                this._log('debug', `Set value for key ${key}`, {
                    oldValue,
                    newValue: validatedValue,
                    batched: this._batchBuffer.has(key),
                });

                return true;
            } catch (error) {
                this._log('error', `Failed to set value for key ${key}:`, error);
                return false;
            }
        }

        private _setGSettingsValue(key: string, value: any, type: CacheEntry['type']): void {
            switch (type) {
                case 'string':
                    this._settings.set_string(key, value);
                    break;
                case 'boolean':
                    this._settings.set_boolean(key, value);
                    break;
                case 'int':
                    this._settings.set_int(key, value);
                    break;
                case 'double':
                    this._settings.set_double(key, value);
                    break;
                case 'strv':
                    this._settings.set_strv(key, value);
                    break;
                case 'variant': {
                    const variant = new GLib.Variant(
                        'v',
                        new GLib.Variant('s', JSON.stringify(value))
                    );
                    this._settings.set_value(key, variant);
                    break;
                }
            }
        }

        private _handleSettingsChange(key: string): void {
            const entry = this._cache.get(key);
            if (entry) {
                // Invalidate cache entry to force reload
                this.invalidate(key);
                this._log('debug', `Settings changed externally for key: ${key}`);
            }
        }

        private _validateValue(key: string, value: any): any {
            if (!this._config.enableValidation) {
                return value;
            }

            const validator = this._validators.get(key);
            if (validator) {
                try {
                    const result = validator(value);
                    if (result === false || (typeof result === 'string' && result.length > 0)) {
                        this._statistics.validationFailures++;
                        this.emit('validation-failed', key, value);
                        this._log('warn', `Validation failed for key ${key}:`, { value, result });
                        return null;
                    }
                } catch (error) {
                    this._statistics.validationFailures++;
                    this._log('error', `Validator error for key ${key}:`, error);
                    return null;
                }
            }

            return value;
        }

        private _transformValue(key: string, value: any): any {
            if (!this._config.enableTransformation) {
                return value;
            }

            const transformer = this._transformers.get(key);
            if (transformer) {
                try {
                    return transformer(value);
                } catch (error) {
                    this._statistics.transformationFailures++;
                    this._log('error', `Transformer error for key ${key}:`, error);
                    return value;
                }
            }

            return value;
        }

        private _isExpired(entry: CacheEntry): boolean {
            const age = Date.now() - entry.timestamp;
            return age > this._config.maxAge;
        }

        private _startFlushTimer(): void {
            if (this._config.autoFlush && this._config.flushInterval > 0) {
                this._flushTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    this._config.flushInterval,
                    () => {
                        this.flush();
                        return GLib.SOURCE_CONTINUE;
                    }
                );
            }
        }

        private _stopFlushTimer(): void {
            if (this._flushTimeoutId) {
                GLib.source_remove(this._flushTimeoutId);
                this._flushTimeoutId = null;
            }
        }

        private _updateHitRate(hit: boolean): void {
            const total = this._statistics.accessCount;
            if (hit) {
                this._statistics.hitRate = (this._statistics.hitRate * (total - 1) + 1) / total;
                this._statistics.missRate = 1 - this._statistics.hitRate;
            } else {
                this._statistics.hitRate = (this._statistics.hitRate * (total - 1)) / total;
                this._statistics.missRate = 1 - this._statistics.hitRate;
            }
        }

        private _updateStatistics(): void {
            this._statistics.totalEntries = this._cache.size;
            this._statistics.memoryUsage = this._estimateMemoryUsage();

            if (this._cache.size > 0) {
                const entries = Array.from(this._cache.values());
                this._statistics.oldestEntry = Math.min(...entries.map(e => e.timestamp));
                this._statistics.newestEntry = Math.max(...entries.map(e => e.timestamp));
            }

            if (this._config.enableStatistics) {
                this.emit('statistics-updated', this._statistics);
            }
        }

        private _estimateMemoryUsage(): number {
            // Rough estimate of memory usage
            let size = 0;
            for (const entry of this._cache.values()) {
                size += JSON.stringify(entry).length * 2; // Rough estimate
            }
            return size;
        }

        private _log(level: string, message: string, data?: any): void {
            if (this._logger) {
                this._logger.log(level, `[ConfigCache] ${message}`, data);
            } else {
                const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
                console[method](`[ConfigCache] ${message}`, data || '');
            }
        }
    }
);
// eslint-disable-next-line no-redeclare
export type ConfigCache = InstanceType<typeof ConfigCache>;
