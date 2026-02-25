/**
 * Effect Manager for GNOME Shell Grayscale Toggle Extension
 * Clutter.DesaturateEffect lifecycle management and application
 */

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import { adjustAnimationTime } from 'resource:///org/gnome/shell/misc/animationUtils.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import type {
    EffectChangeEvent,
    EffectConfig,
    EffectState,
    EffectManager as IEffectManager,
} from './types/effects.js';
import type { ExtensionComponent } from './types/extension.js';
import type { MonitorInfo } from './types/monitors.js';

// Extension interface for component access
interface Extension {
    getComponent(name: string): any;
}

// Effect operation options
interface EffectOperationOptions {
    animated?: boolean;
    duration?: number;
    skipEvents?: boolean;
    force?: boolean;
}

// Effect queue operation
interface EffectOperation {
    type: 'global' | 'monitor';
    monitorIndex?: number;
    enabled: boolean;
    options: EffectOperationOptions;
}

// Animation settings
interface AnimationSettings {
    duration: number;
    easing: Clutter.AnimationMode;
}

export const EffectManager = GObject.registerClass(
    {
        GTypeName: 'GrayscaleEffectManager',
        Signals: {
            'effect-applied': {
                param_types: [GObject.TYPE_INT, GObject.TYPE_STRING, GObject.TYPE_BOOLEAN],
            },
            'effect-removed': {
                param_types: [GObject.TYPE_INT, GObject.TYPE_STRING, GObject.TYPE_BOOLEAN],
            },
            'all-effects-removed': {},
        },
    },
    class EffectManager extends GObject.Object implements IEffectManager, ExtensionComponent {
        private _extension: Extension;
        private _effects: Map<string | number, any>; // Clutter.Effect instances
        private _stateManager: any = null;
        private _monitorManager: any = null;
        private _animationSettings: AnimationSettings;
        private _effectQueue: EffectOperation[];
        private _processing: boolean;
        private _suspended: boolean;
        private _performanceMode: boolean;
        private _initialized: boolean;

        constructor(extension: Extension) {
            super();

            this._extension = extension;
            this._effects = new Map();
            this._stateManager = null;
            this._animationSettings = {
                duration: 300,
                easing: Clutter.AnimationMode.EASE_IN_OUT,
            };
            this._effectQueue = [];
            this._processing = false;
            this._suspended = false;
            this._performanceMode = false;
            this._initialized = false;
        }

        // Initialization
        async initialize(): Promise<boolean> {
            if (this._initialized) {
                return true;
            }

            try {
                // Get component references
                this._stateManager = this._extension.getComponent('StateManager');
                this._monitorManager = this._extension.getComponent('MonitorManager');

                if (!this._stateManager) {
                    throw new Error('StateManager component not available');
                }

                // MonitorManager is optional in Phase 1 but required for full Phase 2 functionality
                if (!this._monitorManager) {
                    console.warn(
                        '[EffectManager] MonitorManager not available, using global mode only'
                    );
                }

                // Load animation settings
                this._loadAnimationSettings();

                // Connect to state changes
                this._connectStateSignals();

                this._initialized = true;
                console.log('[EffectManager] Initialized successfully');
                return true;
            } catch (error) {
                console.error('[EffectManager] Initialization failed:', error);
                throw error;
            }
        }

        enable(): void {
            this.initialize().catch(error => {
                console.error('[EffectManager] Failed to enable:', error);
            });
        }

        disable(): void {
            this.destroy();
        }

        destroy(): void {
            if (!this._initialized) {
                return;
            }

            // Remove all effects immediately (no animation during shutdown)
            this.removeAllEffects({ animated: false }).catch(error => {
                console.warn('[EffectManager] Failed to remove effects during destruction:', error);
            });

            // Clear queue
            this._effectQueue = [];
            this._processing = false;

            // Clear references
            this._effects.clear();
            this._stateManager = null;
            this._monitorManager = null;
            this._initialized = false;

            console.log('[EffectManager] Destroyed successfully');
        }

        // IEffectManager interface implementation
        get effects(): Map<number, EffectState> {
            const effectStates = new Map<number, EffectState>();
            this._effects.forEach((effect, key) => {
                if (typeof key === 'number') {
                    effectStates.set(key, {
                        isActive: true,
                        config: {} as EffectConfig,
                        monitorIndex: key,
                    });
                }
            });
            return effectStates;
        }

        async applyEffect(monitor: MonitorInfo, config: EffectConfig): Promise<void> {
            await this.applyMonitorEffect(monitor.index, true, {
                animated: config.animationDuration > 0,
                duration: config.animationDuration,
            });
        }

        async removeEffect(monitorIndex: number): Promise<void> {
            await this.applyMonitorEffect(monitorIndex, false);
        }

        async updateEffect(monitorIndex: number, config: Partial<EffectConfig>): Promise<void> {
            const currentEffect = this._effects.get(monitorIndex);
            if (currentEffect && config.brightness !== undefined) {
                currentEffect.factor = 1.0 - config.brightness;
            }
        }

        async toggleEffect(monitorIndex: number, _config?: EffectConfig): Promise<void> {
            const isActive = this.isEffectActive(monitorIndex);
            await this.applyMonitorEffect(monitorIndex, !isActive);
        }

        connectSignal(signal: string, callback: (event: EffectChangeEvent) => void): number {
            return (super.connect as any)(signal, callback);
        }

        disconnectSignal(id: number): void {
            (super.disconnect as any)(id);
        }

        // Public API
        async applyGlobalEffect(
            enabled: boolean,
            options: EffectOperationOptions = {}
        ): Promise<boolean> {
            const {
                animated = true,
                duration = this._animationSettings.duration,
                skipEvents = false,
                force = false,
            } = options;

            if (this._suspended && !force) {
                console.log('[EffectManager] Effects suspended, skipping application');
                return true;
            }

            if (!this._initialized) {
                throw new Error('EffectManager not initialized');
            }

            console.log(
                `[EffectManager] Applying global effect: ${enabled} (animated: ${animated})`
            );

            try {
                if (this._isPerMonitorMode()) {
                    // Apply to all monitors individually
                    const monitors = this._monitorManager.getActiveMonitors();
                    const promises = monitors.map((monitor: MonitorInfo) =>
                        this.applyMonitorEffect(monitor.index, enabled, {
                            animated,
                            duration,
                            skipEvents: true, // Avoid duplicate events
                        })
                    );

                    const results = await Promise.all(promises);
                    const success = results.every(result => result);

                    if (!skipEvents) {
                        (this as any).emit('effect-applied', -1, 'global', success);
                    }

                    return success;
                } else {
                    // Apply to global stage
                    const success = await this._applyStageEffect(enabled, {
                        animated,
                        duration,
                        skipEvents,
                    });

                    if (!skipEvents) {
                        (this as any).emit('effect-applied', -1, 'global', success);
                    }

                    return success;
                }
            } catch (error) {
                if (!skipEvents) {
                    (this as any).emit('effect-applied', -1, 'global', false);
                }
                throw new Error(`Global effect application failed: ${(error as Error).message}`);
            }
        }

        async applyMonitorEffect(
            monitorIndex: number,
            enabled: boolean,
            options: EffectOperationOptions = {}
        ): Promise<boolean> {
            const {
                animated = true,
                duration = this._animationSettings.duration,
                skipEvents = false,
            } = options;

            if (!Number.isInteger(monitorIndex) || monitorIndex < 0) {
                throw new Error(`Invalid monitor index: ${monitorIndex}`);
            }

            if (!this._initialized) {
                throw new Error('EffectManager not initialized');
            }

            console.log(
                `[EffectManager] Applying monitor effect: monitor ${monitorIndex}, enabled: ${enabled}`
            );

            try {
                const operation: EffectOperation = {
                    type: 'monitor',
                    monitorIndex,
                    enabled,
                    options: { animated, duration, skipEvents },
                };

                return await this._queueOperation(operation);
            } catch (error) {
                if (!skipEvents) {
                    (this as any).emit('effect-applied', monitorIndex, 'monitor', false);
                }
                throw new Error(`Monitor effect application failed: ${(error as Error).message}`);
            }
        }

        async removeAllEffects(options: EffectOperationOptions = {}): Promise<void> {
            const { animated = false, duration = 200 } = options;

            console.log('[EffectManager] Removing all effects');

            const removePromises: Promise<boolean>[] = [];

            // Remove stage effect if present
            if (this._effects.has('stage')) {
                removePromises.push(this._removeStageEffect({ animated, duration }));
            }

            // Remove all monitor effects
            for (const [monitorIndex, _effect] of this._effects) {
                if (monitorIndex !== 'stage') {
                    removePromises.push(
                        this._removeMonitorEffect(parseInt(monitorIndex as string), {
                            animated,
                            duration,
                        })
                    );
                }
            }

            await Promise.all(removePromises);
            this._effects.clear();

            (this as any).emit('all-effects-removed');
            console.log('[EffectManager] All effects removed');
        }

        // State Queries
        isEffectActive(monitorIndex = -1): boolean {
            const key = monitorIndex === -1 ? 'stage' : monitorIndex.toString();
            return this._effects.has(key);
        }

        getActiveEffects(): Map<string | number, any> {
            return new Map(this._effects);
        }

        getEffectCount(): number {
            return this._effects.size;
        }

        // Performance Management
        async suspendEffects(): Promise<void> {
            if (this._suspended) {
                return;
            }

            this._suspended = true;

            for (const [_key, effect] of this._effects) {
                if (effect && effect.set_enabled) {
                    effect.set_enabled(false);
                }
            }

            console.log('[EffectManager] Effects suspended for performance');
        }

        async resumeEffects(): Promise<void> {
            if (!this._suspended) {
                return;
            }

            this._suspended = false;

            for (const [_key, effect] of this._effects) {
                if (effect && effect.set_enabled) {
                    effect.set_enabled(true);
                }
            }

            console.log('[EffectManager] Effects resumed');
        }

        setPerformanceMode(enabled: boolean): void {
            this._performanceMode = enabled;

            if (enabled) {
                this._animationSettings.duration = Math.min(this._animationSettings.duration, 150);
            } else {
                // Restore from settings
                const duration = this._stateManager?.getSetting('animationDuration') || 0.3;
                this._animationSettings.duration = duration * 1000;
            }

            console.log(`[EffectManager] Performance mode ${enabled ? 'enabled' : 'disabled'}`);
        }

        // Private Implementation
        private _loadAnimationSettings(): void {
            const duration = this._stateManager.getSetting('animationDuration');
            if (typeof duration === 'number') {
                this._animationSettings.duration = duration * 1000; // Convert to ms
            }

            const performanceMode = this._stateManager.getSetting('performanceMode');
            this.setPerformanceMode(performanceMode as boolean);
        }

        private _connectStateSignals(): void {
            this._stateManager.connect(
                'state-changed',
                (manager: any, globalState: boolean, previousState: boolean, options: any) =>
                    this._handleGlobalStateChange(globalState, previousState, options)
            );

            this._stateManager.connect(
                'monitor-state-changed',
                (manager: any, monitorIndex: number, enabled: boolean, previousState: any) =>
                    this._handleMonitorStateChange(monitorIndex, enabled, previousState)
            );

            this._stateManager.connect(
                'settings-changed',
                (manager: any, key: string, variant: any) => this._handleSettingChange(key, variant)
            );
        }

        private async _handleGlobalStateChange(
            globalState: boolean,
            previousState: boolean,
            options: any
        ): Promise<void> {
            if (globalState !== previousState) {
                try {
                    const optionsDict = options ? options.unpack() : {};
                    const animated = optionsDict.animated ? optionsDict.animated.unpack() : true;

                    await this.applyGlobalEffect(globalState, {
                        animated,
                        skipEvents: true, // Avoid circular events
                    });
                } catch (error) {
                    console.error('[EffectManager] Failed to apply global state change:', error);
                }
            }
        }

        private async _handleMonitorStateChange(
            monitorIndex: number,
            enabled: boolean,
            previousState: any
        ): Promise<void> {
            if (enabled !== previousState) {
                try {
                    await this.applyMonitorEffect(monitorIndex, enabled, {
                        skipEvents: true, // Avoid circular events
                    });
                } catch (error) {
                    console.error(
                        `[EffectManager] Failed to apply monitor state change for monitor ${monitorIndex}:`,
                        error
                    );
                }
            }
        }

        private _handleSettingChange(key: string, variant: any): void {
            if (key === 'animationDuration') {
                const duration = variant.get_double();
                this._animationSettings.duration = duration * 1000;
            } else if (key === 'performanceMode') {
                const enabled = variant.get_boolean();
                this.setPerformanceMode(enabled);
            }
        }

        private _isPerMonitorMode(): boolean {
            return this._stateManager?.getSetting('per-monitor-mode') === true;
        }

        // Stage Effect Implementation
        private async _applyStageEffect(
            enabled: boolean,
            options: EffectOperationOptions = {}
        ): Promise<boolean> {
            const {
                animated = true,
                duration = this._animationSettings.duration,
                skipEvents = false,
            } = options;

            if (enabled) {
                return await this._addStageEffect({ animated, duration, skipEvents });
            } else {
                return await this._removeStageEffect({ animated, duration, skipEvents });
            }
        }

        private async _addStageEffect(options: EffectOperationOptions = {}): Promise<boolean> {
            const {
                animated = true,
                duration = this._animationSettings.duration,
                skipEvents = false,
            } = options;

            try {
                // Check if effect already exists
                if (this._effects.has('stage')) {
                    console.log('[EffectManager] Stage effect already active');
                    return true;
                }

                // Create desaturate effect
                const effect = new Clutter.DesaturateEffect({
                    factor: 0.0, // Start with no desaturation
                });

                // Apply to global stage
                const stage = Main.layoutManager.uiGroup;
                stage.add_effect(effect);

                // Store effect reference
                this._effects.set('stage', effect);

                if (animated && duration > 0) {
                    // Animate the desaturation factor from 0.0 to 1.0
                    (effect as any).ease_property('factor', 1.0, {
                        duration: adjustAnimationTime(duration),
                        mode: this._animationSettings.easing,
                        onComplete: () => {
                            if (!skipEvents) {
                                (this as any).emit('effect-applied', -1, 'stage', true);
                            }
                        },
                    });
                } else {
                    // Apply immediately
                    (effect as any).factor = 1.0;
                    if (!skipEvents) {
                        (this as any).emit('effect-applied', -1, 'stage', true);
                    }
                }

                console.log('[EffectManager] Stage effect added successfully');
                return true;
            } catch (error) {
                console.error('[EffectManager] Failed to add stage effect:', error);
                return false;
            }
        }

        private async _removeStageEffect(options: EffectOperationOptions = {}): Promise<boolean> {
            const {
                animated = true,
                duration = this._animationSettings.duration,
                skipEvents = false,
            } = options;

            try {
                const effect = this._effects.get('stage');
                if (!effect) {
                    console.log('[EffectManager] No stage effect to remove');
                    return true;
                }

                const stage = Main.layoutManager.uiGroup;

                if (animated && duration > 0) {
                    // Animate the desaturation factor from 1.0 to 0.0
                    (effect as any).ease_property('factor', 0.0, {
                        duration: adjustAnimationTime(duration),
                        mode: this._animationSettings.easing,
                        onComplete: () => {
                            stage.remove_effect(effect);
                            this._effects.delete('stage');

                            if (!skipEvents) {
                                (this as any).emit('effect-removed', -1, 'stage', true);
                            }
                        },
                    });
                } else {
                    // Remove immediately
                    stage.remove_effect(effect);
                    this._effects.delete('stage');

                    if (!skipEvents) {
                        (this as any).emit('effect-removed', -1, 'stage', true);
                    }
                }

                console.log('[EffectManager] Stage effect removed successfully');
                return true;
            } catch (error) {
                console.error('[EffectManager] Failed to remove stage effect:', error);
                return false;
            }
        }

        // Monitor Effect Implementation
        private async _addMonitorEffect(
            monitorIndex: number,
            options: EffectOperationOptions = {}
        ): Promise<boolean> {
            const {
                animated = true,
                duration = this._animationSettings.duration,
                skipEvents = false,
            } = options;

            try {
                const key = monitorIndex.toString();

                // Check if effect already exists
                if (this._effects.has(key)) {
                    console.log(`[EffectManager] Monitor ${monitorIndex} effect already active`);
                    return true;
                }

                // Get monitor-specific actor
                let targetActor: any = null;

                if (this._monitorManager) {
                    // Phase 2: True per-monitor effects
                    targetActor = this._monitorManager.getMonitorActor(monitorIndex);

                    if (!targetActor) {
                        console.warn(
                            `[EffectManager] No actor found for monitor ${monitorIndex}, falling back to stage`
                        );
                        targetActor = Main.layoutManager.uiGroup;
                    }
                } else {
                    // Phase 1: Global stage fallback
                    targetActor = Main.layoutManager.uiGroup;
                }

                // Create monitor-specific desaturate effect
                const effect = new Clutter.DesaturateEffect({
                    factor: 0.0,
                });

                // Apply effect to target actor
                targetActor.add_effect(effect);

                // Store effect reference
                this._effects.set(key, effect);

                if (animated && duration > 0) {
                    // Animate the desaturation
                    (effect as any).ease_property('factor', 1.0, {
                        duration: adjustAnimationTime(duration),
                        mode: this._animationSettings.easing,
                        onComplete: () => {
                            if (!skipEvents) {
                                (this as any).emit('effect-applied', monitorIndex, 'monitor', true);
                            }
                        },
                    });
                } else {
                    // Apply immediately
                    (effect as any).factor = 1.0;
                    if (!skipEvents) {
                        (this as any).emit('effect-applied', monitorIndex, 'monitor', true);
                    }
                }

                console.log(`[EffectManager] Monitor ${monitorIndex} effect added successfully`);
                return true;
            } catch (error) {
                console.error(
                    `[EffectManager] Failed to add monitor ${monitorIndex} effect:`,
                    error
                );
                return false;
            }
        }

        private async _removeMonitorEffect(
            monitorIndex: number,
            options: EffectOperationOptions = {}
        ): Promise<boolean> {
            const {
                animated = true,
                duration = this._animationSettings.duration,
                skipEvents = false,
            } = options;

            try {
                const key = monitorIndex.toString();
                const effect = this._effects.get(key);

                if (!effect) {
                    console.log(`[EffectManager] No monitor ${monitorIndex} effect to remove`);
                    return true;
                }

                // Get the parent actor to remove the effect from
                let targetActor: any = null;

                if (this._monitorManager) {
                    targetActor = this._monitorManager.getMonitorActor(monitorIndex);
                }

                if (!targetActor) {
                    targetActor = Main.layoutManager.uiGroup;
                }

                if (animated && duration > 0) {
                    // Animate the desaturation removal
                    (effect as any).ease_property('factor', 0.0, {
                        duration: adjustAnimationTime(duration),
                        mode: this._animationSettings.easing,
                        onComplete: () => {
                            targetActor.remove_effect(effect);
                            this._effects.delete(key);

                            if (!skipEvents) {
                                (this as any).emit('effect-removed', monitorIndex, 'monitor', true);
                            }
                        },
                    });
                } else {
                    // Remove immediately
                    targetActor.remove_effect(effect);
                    this._effects.delete(key);

                    if (!skipEvents) {
                        (this as any).emit('effect-removed', monitorIndex, 'monitor', true);
                    }
                }

                console.log(`[EffectManager] Monitor ${monitorIndex} effect removed successfully`);
                return true;
            } catch (error) {
                console.error(
                    `[EffectManager] Failed to remove monitor ${monitorIndex} effect:`,
                    error
                );
                return false;
            }
        }

        // Operation Queue Management
        private async _queueOperation(operation: EffectOperation): Promise<boolean> {
            return new Promise((resolve, reject) => {
                this._effectQueue.push({
                    ...operation,
                    options: {
                        ...operation.options,
                        resolve,
                        reject,
                    } as any,
                });

                this._processQueue();
            });
        }

        private async _processQueue(): Promise<void> {
            if (this._processing || this._effectQueue.length === 0) {
                return;
            }

            this._processing = true;

            while (this._effectQueue.length > 0) {
                const operation = this._effectQueue.shift()!;

                try {
                    let result = false;

                    if (operation.type === 'global') {
                        result = await this._applyStageEffect(operation.enabled, operation.options);
                    } else if (operation.type === 'monitor') {
                        result = await this._applyMonitorEffect(
                            operation.monitorIndex!,
                            operation.enabled,
                            operation.options
                        );
                    }

                    if ((operation.options as any).resolve) {
                        (operation.options as any).resolve(result);
                    }
                } catch (error) {
                    if ((operation.options as any).reject) {
                        (operation.options as any).reject(error);
                    }
                }
            }

            this._processing = false;
        }

        private async _applyMonitorEffect(
            monitorIndex: number,
            enabled: boolean,
            options: EffectOperationOptions = {}
        ): Promise<boolean> {
            if (enabled) {
                return await this._addMonitorEffect(monitorIndex, options);
            } else {
                return await this._removeMonitorEffect(monitorIndex, options);
            }
        }

        // Debugging
        dumpEffects(): void {
            console.log('[EffectManager] Active effects:');
            for (const [key, effect] of this._effects) {
                console.log(
                    `  ${key}: factor=${effect.factor || 'unknown'}, enabled=${effect.enabled || 'unknown'}`
                );
            }
        }
    }
);

export type EffectManagerType = InstanceType<typeof EffectManager>;
