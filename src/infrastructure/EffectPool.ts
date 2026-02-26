/**
 * EffectPool - Professional resource pooling for Clutter effects
 * Efficient resource management with automatic cleanup and monitoring
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

// Pool configuration
export interface EffectPoolConfig {
    initialSize?: number;
    maxSize?: number;
    maxIdleTime?: number; // milliseconds
    cleanupInterval?: number; // milliseconds
    enableStatistics?: boolean;
    preallocationStrategy?: 'lazy' | 'eager';
}

// Effect metadata for tracking
export interface EffectMetadata {
    effect: Clutter.Effect;
    created: number;
    lastUsed: number;
    useCount: number;
    inUse: boolean;
    id: string;
}

// Pool statistics
export interface PoolStatistics {
    totalCreated: number;
    totalDestroyed: number;
    currentAvailable: number;
    currentInUse: number;
    peakUsage: number;
    averageUseTime: number;
    hitRate: number; // percentage of acquires that reused existing effects
    missRate: number; // percentage of acquires that created new effects
}

// Effect factory interface
export interface EffectFactory<T extends Clutter.Effect = Clutter.Effect> {
    create(): T;
    reset(effect: T): void;
    destroy(effect: T): void;
    validate(effect: T): boolean;
}

// Built-in factory for DesaturateEffect
export class DesaturateEffectFactory implements EffectFactory<Clutter.DesaturateEffect> {
    create(): Clutter.DesaturateEffect {
        return new Clutter.DesaturateEffect();
    }

    reset(effect: Clutter.DesaturateEffect): void {
        // Reset desaturation to full color
        effect.set_factor(0.0);
        // Ensure effect is enabled
        effect.set_enabled(true);
    }

    destroy(effect: Clutter.DesaturateEffect): void {
        // Clutter effects are automatically cleaned up by GC
        // But we should disable them first
        effect.set_enabled(false);
    }

    validate(effect: Clutter.DesaturateEffect): boolean {
        // Check if the effect is still valid
        return effect && typeof effect.set_factor === 'function';
    }
}

export const EffectPool = GObject.registerClass(
    {
        GTypeName: 'GrayscaleEffectPool',
        Signals: {
            'effect-acquired': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_BOOLEAN], // id, wasReused
            },
            'effect-released': {
                param_types: [GObject.TYPE_STRING], // id
            },
            'pool-cleaned': {
                param_types: [GObject.TYPE_INT], // removedCount
            },
            'statistics-updated': {
                param_types: [GObject.TYPE_JSOBJECT], // stats object
            },
        },
    },
    class EffectPool extends GObject.Object {
        private _factory: EffectFactory<Clutter.Effect>;
        private _config: Required<EffectPoolConfig>;
        private _available: Map<string, EffectMetadata> = new Map();
        private _inUse: Map<string, EffectMetadata> = new Map();
        private _statistics: PoolStatistics;
        private _cleanupTimeoutId: number | null = null;
        private _nextId = 1;
        private _logger: any = null;
        private _destroyed = false;

        constructor(factory: EffectFactory<Clutter.Effect>, config: EffectPoolConfig = {}) {
            super();

            this._factory = factory;
            this._config = {
                initialSize: 5,
                maxSize: 50,
                maxIdleTime: 300000, // 5 minutes
                cleanupInterval: 60000, // 1 minute
                enableStatistics: true,
                preallocationStrategy: 'lazy',
                ...config,
            };

            this._statistics = {
                totalCreated: 0,
                totalDestroyed: 0,
                currentAvailable: 0,
                currentInUse: 0,
                peakUsage: 0,
                averageUseTime: 0,
                hitRate: 0,
                missRate: 0,
            };

            this._initialize();
        }

        // Public API
        acquire(): Clutter.Effect {
            if (this._destroyed) {
                throw new Error('EffectPool has been destroyed');
            }

            const startTime = Date.now();
            let effect: Clutter.Effect;
            let metadata: EffectMetadata;
            let wasReused = false;

            // Try to reuse an available effect
            const availableId = this._findBestAvailableEffect();
            if (availableId) {
                metadata = this._available.get(availableId)!;
                effect = metadata.effect as Clutter.Effect;
                this._available.delete(availableId);
                wasReused = true;

                // Reset the effect to a clean state
                this._factory.reset(effect);
            } else {
                // Create a new effect
                try {
                    effect = this._factory.create();
                    metadata = {
                        effect,
                        created: Date.now(),
                        lastUsed: 0,
                        useCount: 0,
                        inUse: false,
                        id: this._generateId(),
                    };
                    this._statistics.totalCreated++;
                } catch (error) {
                    this._log('error', 'Failed to create effect:', error);
                    throw error;
                }
            }

            // Mark as in use
            metadata.inUse = true;
            metadata.lastUsed = Date.now();
            metadata.useCount++;
            this._inUse.set(metadata.id, metadata);

            // Update statistics
            this._updateStatistics(wasReused, Date.now() - startTime);

            this.emit('effect-acquired', metadata.id, wasReused);
            this._log('debug', `Acquired effect ${metadata.id} (reused: ${wasReused})`);

            return effect;
        }

        release(effect: Clutter.Effect): boolean {
            if (this._destroyed) {
                return false;
            }

            // Find the metadata for this effect
            const metadata = this._findMetadataByEffect(effect);
            if (!metadata || !metadata.inUse) {
                this._log('warn', 'Attempted to release effect that is not in use');
                return false;
            }

            // Validate the effect is still usable
            if (!this._factory.validate(effect)) {
                this._log('warn', `Effect ${metadata.id} is no longer valid, destroying`);
                this._destroyMetadata(metadata);
                return true;
            }

            // Check if we've exceeded the maximum pool size
            if (this._available.size >= this._config.maxSize) {
                this._log('debug', `Pool at maximum size, destroying effect ${metadata.id}`);
                this._destroyMetadata(metadata);
                return true;
            }

            // Move from in-use to available
            this._inUse.delete(metadata.id);
            metadata.inUse = false;
            this._available.set(metadata.id, metadata);

            this._updateStatistics();
            this.emit('effect-released', metadata.id);
            this._log('debug', `Released effect ${metadata.id} back to pool`);

            return true;
        }

        // Pool management
        warmUp(count?: number): void {
            if (this._destroyed) {
                return;
            }

            const targetCount = count || this._config.initialSize;
            const currentCount = this._available.size;
            const needed = Math.max(0, targetCount - currentCount);

            this._log('info', `Warming up pool with ${needed} effects`);

            for (let i = 0; i < needed; i++) {
                try {
                    const effect = this._factory.create();
                    const metadata: EffectMetadata = {
                        effect,
                        created: Date.now(),
                        lastUsed: 0,
                        useCount: 0,
                        inUse: false,
                        id: this._generateId(),
                    };

                    this._available.set(metadata.id, metadata);
                    this._statistics.totalCreated++;
                } catch (error) {
                    this._log('error', 'Failed to create effect during warm-up:', error);
                    break;
                }
            }

            this._updateStatistics();
        }

        cleanup(force = false): number {
            if (this._destroyed) {
                return 0;
            }

            const now = Date.now();
            const toRemove: EffectMetadata[] = [];

            for (const metadata of this._available.values()) {
                const idleTime = now - metadata.lastUsed;

                if (force || idleTime > this._config.maxIdleTime) {
                    toRemove.push(metadata);
                }
            }

            // Remove idle effects
            for (const metadata of toRemove) {
                this._available.delete(metadata.id);
                this._destroyMetadata(metadata);
            }

            if (toRemove.length > 0) {
                this._updateStatistics();
                this.emit('pool-cleaned', toRemove.length);
                this._log('debug', `Cleaned up ${toRemove.length} idle effects`);
            }

            return toRemove.length;
        }

        // Inspection and statistics
        getStatistics(): PoolStatistics {
            return { ...this._statistics };
        }

        getAvailableCount(): number {
            return this._available.size;
        }

        getInUseCount(): number {
            return this._inUse.size;
        }

        getTotalCount(): number {
            return this._available.size + this._inUse.size;
        }

        getEffectInfo(effect: Clutter.Effect): EffectMetadata | null {
            const metadata = this._findMetadataByEffect(effect);
            return metadata ? { ...metadata } : null;
        }

        // Configuration
        updateConfig(config: Partial<EffectPoolConfig>): void {
            this._config = { ...this._config, ...config };

            // Restart cleanup timer if interval changed
            if (config.cleanupInterval && this._cleanupTimeoutId) {
                this._stopCleanupTimer();
                this._startCleanupTimer();
            }
        }

        setLogger(logger: any): void {
            this._logger = logger;
        }

        // Lifecycle
        destroy(): void {
            if (this._destroyed) {
                return;
            }

            this._log('info', 'Destroying EffectPool...');

            // Stop cleanup timer
            this._stopCleanupTimer();

            // Destroy all effects
            for (const metadata of this._available.values()) {
                this._destroyMetadata(metadata);
            }

            for (const metadata of this._inUse.values()) {
                this._destroyMetadata(metadata);
            }

            // Clear collections
            this._available.clear();
            this._inUse.clear();

            this._destroyed = true;
            this._log(
                'info',
                `EffectPool destroyed. Total effects created: ${this._statistics.totalCreated}`
            );
        }

        // Private methods
        private _initialize(): void {
            // Start cleanup timer
            this._startCleanupTimer();

            // Pre-allocate effects if using eager strategy
            if (this._config.preallocationStrategy === 'eager') {
                this.warmUp();
            }

            this._log(
                'info',
                `EffectPool initialized with config: ${JSON.stringify(this._config)}`
            );
        }

        private _startCleanupTimer(): void {
            if (this._config.cleanupInterval > 0) {
                this._cleanupTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    this._config.cleanupInterval,
                    () => {
                        this.cleanup();
                        return GLib.SOURCE_CONTINUE;
                    }
                );
            }
        }

        private _stopCleanupTimer(): void {
            if (this._cleanupTimeoutId) {
                GLib.source_remove(this._cleanupTimeoutId);
                this._cleanupTimeoutId = null;
            }
        }

        private _findBestAvailableEffect(): string | null {
            if (this._available.size === 0) {
                return null;
            }

            // Find the most recently used effect (LRU strategy)
            let bestId: string | null = null;
            let bestLastUsed = 0;

            for (const [id, metadata] of this._available.entries()) {
                if (metadata.lastUsed > bestLastUsed) {
                    bestLastUsed = metadata.lastUsed;
                    bestId = id;
                }
            }

            return bestId;
        }

        private _findMetadataByEffect(effect: Clutter.Effect): EffectMetadata | null {
            // Check in-use effects first (more likely)
            for (const metadata of this._inUse.values()) {
                if (metadata.effect === effect) {
                    return metadata;
                }
            }

            // Check available effects
            for (const metadata of this._available.values()) {
                if (metadata.effect === effect) {
                    return metadata;
                }
            }

            return null;
        }

        private _destroyMetadata(metadata: EffectMetadata): void {
            try {
                this._factory.destroy(metadata.effect as Clutter.Effect);
                this._statistics.totalDestroyed++;
            } catch (error) {
                this._log('error', `Error destroying effect ${metadata.id}:`, error);
            }
        }

        private _generateId(): string {
            return `effect_${this._nextId++}_${Date.now()}`;
        }

        private _updateStatistics(wasReused?: boolean, acquisitionTime?: number): void {
            if (!this._config.enableStatistics) {
                return;
            }

            this._statistics.currentAvailable = this._available.size;
            this._statistics.currentInUse = this._inUse.size;
            this._statistics.peakUsage = Math.max(
                this._statistics.peakUsage,
                this._statistics.currentInUse
            );

            // Update hit/miss rates
            if (wasReused !== undefined) {
                const totalAcquisitions =
                    this._statistics.totalCreated - this._statistics.totalDestroyed;
                if (totalAcquisitions > 0) {
                    const hits = wasReused ? 1 : 0;
                    const misses = wasReused ? 0 : 1;

                    this._statistics.hitRate =
                        ((this._statistics.hitRate + hits) / totalAcquisitions) * 100;
                    this._statistics.missRate =
                        ((this._statistics.missRate + misses) / totalAcquisitions) * 100;
                }
            }

            // Update average use time
            if (acquisitionTime) {
                this._statistics.averageUseTime =
                    (this._statistics.averageUseTime + acquisitionTime) / 2;
            }

            this.emit('statistics-updated', this._statistics);
        }

        private _log(level: string, message: string, ...args: any[]): void {
            const prefix = '[EffectPool]';

            if (this._logger) {
                this._logger.log(level, `${prefix} ${message}`, ...args);
            } else {
                // Fallback to console
                const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
                console[method](`${prefix} ${message}`, ...args);
            }
        }
    }
);
// eslint-disable-next-line no-redeclare
export type EffectPool = InstanceType<typeof EffectPool>;

// Convenience function to create a DesaturateEffect pool
export function createDesaturateEffectPool(config?: EffectPoolConfig): EffectPool {
    return new EffectPool(new DesaturateEffectFactory(), config);
}
