// Effect Manager for GNOME Shell Grayscale Toggle Extension
// Clutter.DesaturateEffect lifecycle management and application

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class EffectManager extends GObject.Object {
    static [GObject.signals] = {
        'effect-applied': {
            param_types: [GObject.TYPE_INT, GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]
        },
        'effect-removed': {
            param_types: [GObject.TYPE_INT, GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]
        },
        'all-effects-removed': {}
    };

    constructor(extension) {
        super();
        
        this._extension = extension;
        this._effects = new Map(); // key -> Effect instance (key: 'stage' or monitorIndex)
        this._stateManager = null;
        this._animationSettings = {
            duration: 300,
            easing: Clutter.AnimationMode.EASE_IN_OUT
        };
        this._effectQueue = [];
        this._processing = false;
        this._suspended = false;
        this._performanceMode = false;
        this._initialized = false;
    }
    
    // Initialization
    async initialize() {
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
                console.warn('[EffectManager] MonitorManager not available, using global mode only');
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
    
    destroy() {
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
    
    // Public API
    async applyGlobalEffect(enabled, options = {}) {
        const {
            animated = true,
            duration = this._animationSettings.duration,
            skipEvents = false,
            force = false
        } = options;
        
        if (this._suspended && !force) {
            console.log('[EffectManager] Effects suspended, skipping application');
            return true;
        }
        
        if (!this._initialized) {
            throw new Error('EffectManager not initialized');
        }
        
        console.log(`[EffectManager] Applying global effect: ${enabled} (animated: ${animated})`);
        
        try {
            if (this._isPerMonitorMode()) {
                // Apply to all monitors individually
                const monitors = this._monitorManager.getActiveMonitors();
                const promises = monitors.map(monitor =>
                    this.applyMonitorEffect(monitor.index, enabled, {
                        animated,
                        duration,
                        skipEvents: true // Avoid duplicate events
                    })
                );
                
                const results = await Promise.all(promises);
                const success = results.every(result => result);
                
                if (!skipEvents) {
                    this.emit('effect-applied', -1, 'global', success);
                }
                
                return success;
            } else {
                // Apply to global stage
                const success = await this._applyStageEffect(enabled, {
                    animated,
                    duration,
                    skipEvents
                });
                
                if (!skipEvents) {
                    this.emit('effect-applied', -1, 'global', success);
                }
                
                return success;
            }
            
        } catch (error) {
            if (!skipEvents) {
                this.emit('effect-applied', -1, 'global', false);
            }
            throw new Error(`Global effect application failed: ${error.message}`);
        }
    }
    
    async applyMonitorEffect(monitorIndex, enabled, options = {}) {
        const {
            animated = true,
            duration = this._animationSettings.duration,
            skipEvents = false
        } = options;
        
        if (!Number.isInteger(monitorIndex) || monitorIndex < 0) {
            throw new Error(`Invalid monitor index: ${monitorIndex}`);
        }
        
        if (!this._initialized) {
            throw new Error('EffectManager not initialized');
        }
        
        console.log(`[EffectManager] Applying monitor effect: monitor ${monitorIndex}, enabled: ${enabled}`);
        
        try {
            const operation = {
                type: 'monitor',
                monitorIndex,
                enabled,
                options: { animated, duration, skipEvents }
            };
            
            return await this._queueOperation(operation);
            
        } catch (error) {
            if (!skipEvents) {
                this.emit('effect-applied', monitorIndex, 'monitor', false);
            }
            throw new Error(`Monitor effect application failed: ${error.message}`);
        }
    }
    
    async removeAllEffects(options = {}) {
        const { animated = false, duration = 200 } = options;
        
        console.log('[EffectManager] Removing all effects');
        
        const removePromises = [];
        
        // Remove stage effect if present
        if (this._effects.has('stage')) {
            removePromises.push(
                this._removeStageEffect({ animated, duration })
            );
        }
        
        // Remove all monitor effects
        for (const [monitorIndex, effect] of this._effects) {
            if (monitorIndex !== 'stage') {
                removePromises.push(
                    this._removeMonitorEffect(parseInt(monitorIndex), { 
                        animated, duration 
                    })
                );
            }
        }
        
        await Promise.all(removePromises);
        this._effects.clear();
        
        this.emit('all-effects-removed');
        console.log('[EffectManager] All effects removed');
    }
    
    // State Queries
    isEffectActive(monitorIndex = -1) {
        const key = monitorIndex === -1 ? 'stage' : monitorIndex.toString();
        return this._effects.has(key);
    }
    
    getActiveEffects() {
        return new Map(this._effects);
    }
    
    getEffectCount() {
        return this._effects.size;
    }
    
    // Performance Management
    async suspendEffects() {
        if (this._suspended) return;
        
        this._suspended = true;
        
        for (const [key, effect] of this._effects) {
            if (effect && effect.set_enabled) {
                effect.set_enabled(false);
            }
        }
        
        console.log('[EffectManager] Effects suspended for performance');
    }
    
    async resumeEffects() {
        if (!this._suspended) return;
        
        this._suspended = false;
        
        for (const [key, effect] of this._effects) {
            if (effect && effect.set_enabled) {
                effect.set_enabled(true);
            }
        }
        
        console.log('[EffectManager] Effects resumed');
    }
    
    setPerformanceMode(enabled) {
        this._performanceMode = enabled;
        
        if (enabled) {
            this._animationSettings.duration = Math.min(
                this._animationSettings.duration, 150
            );
        } else {
            // Restore from settings
            const duration = this._stateManager?.getSetting('animationDuration') || 0.3;
            this._animationSettings.duration = duration * 1000;
        }
        
        console.log(`[EffectManager] Performance mode ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    // Private Implementation
    _loadAnimationSettings() {
        const duration = this._stateManager.getSetting('animationDuration');
        if (typeof duration === 'number') {
            this._animationSettings.duration = duration * 1000; // Convert to ms
        }
        
        const performanceMode = this._stateManager.getSetting('performanceMode');
        this.setPerformanceMode(performanceMode);
    }
    
    _connectStateSignals() {
        this._stateManager.connect('state-changed',
            (manager, globalState, previousState, options) => 
                this._handleGlobalStateChange(globalState, previousState, options)
        );
        
        this._stateManager.connect('monitor-state-changed',
            (manager, monitorIndex, enabled, previousState) =>
                this._handleMonitorStateChange(monitorIndex, enabled, previousState)
        );
        
        this._stateManager.connect('settings-changed',
            (manager, key, variant) => this._handleSettingChange(key, variant)
        );
    }
    
    async _handleGlobalStateChange(globalState, previousState, options) {
        if (globalState !== previousState) {
            try {
                const optionsDict = options ? options.unpack() : {};
                const animated = optionsDict.animated ? optionsDict.animated.unpack() : true;
                
                await this.applyGlobalEffect(globalState, { 
                    animated,
                    skipEvents: true // Avoid circular events
                });
            } catch (error) {
                console.error('[EffectManager] Failed to apply global state change:', error);
            }
        }
    }
    
    async _handleMonitorStateChange(monitorIndex, enabled, previousState) {
        if (enabled !== previousState) {
            try {
                await this.applyMonitorEffect(monitorIndex, enabled, { 
                    skipEvents: true // Avoid circular events
                });
            } catch (error) {
                console.error(`[EffectManager] Failed to apply monitor state change for monitor ${monitorIndex}:`, error);
            }
        }
    }
    
    _handleSettingChange(key, variant) {
        if (key === 'animationDuration') {
            const duration = variant.get_double();
            this._animationSettings.duration = duration * 1000;
        } else if (key === 'performanceMode') {
            const enabled = variant.get_boolean();
            this.setPerformanceMode(enabled);
        }
    }
    
    // Stage Effect Implementation
    async _applyStageEffect(enabled, options = {}) {
        const { animated = true, duration = this._animationSettings.duration, skipEvents = false } = options;
        
        if (enabled) {
            return await this._addStageEffect({ animated, duration, skipEvents });
        } else {
            return await this._removeStageEffect({ animated, duration, skipEvents });
        }
    }
    
    async _addStageEffect(options = {}) {
        const { animated = true, duration = this._animationSettings.duration, skipEvents = false } = options;
        
        try {
            // Check if effect already exists
            if (this._effects.has('stage')) {
                console.log('[EffectManager] Stage effect already active');
                return true;
            }
            
            // Create desaturate effect
            const effect = new Clutter.DesaturateEffect({
                factor: 0.0 // Start with no desaturation
            });
            
            // Apply to global stage
            const stage = Main.layoutManager.uiGroup;
            stage.add_effect(effect);
            
            // Store effect reference
            this._effects.set('stage', effect);
            
            if (animated && duration > 0) {
                // Animate the desaturation factor from 0.0 to 1.0
                effect.ease_property('factor', 1.0, {
                    duration: duration,
                    mode: this._animationSettings.easing,
                    onComplete: () => {
                        if (!skipEvents) {
                            this.emit('effect-applied', -1, 'stage', true);
                        }
                    }
                });
            } else {
                // Apply immediately
                effect.factor = 1.0;
                if (!skipEvents) {
                    this.emit('effect-applied', -1, 'stage', true);
                }
            }
            
            console.log('[EffectManager] Stage effect added successfully');
            return true;
            
        } catch (error) {
            console.error('[EffectManager] Failed to add stage effect:', error);
            return false;
        }
    }
    
    async _removeStageEffect(options = {}) {
        const { animated = true, duration = this._animationSettings.duration, skipEvents = false } = options;
        
        try {
            const effect = this._effects.get('stage');
            if (!effect) {
                console.log('[EffectManager] No stage effect to remove');
                return true;
            }
            
            const stage = Main.layoutManager.uiGroup;
            
            if (animated && duration > 0) {
                // Animate the desaturation factor from 1.0 to 0.0
                effect.ease_property('factor', 0.0, {
                    duration: duration,
                    mode: this._animationSettings.easing,
                    onComplete: () => {
                        stage.remove_effect(effect);
                        this._effects.delete('stage');
                        
                        if (!skipEvents) {
                            this.emit('effect-removed', -1, 'stage', true);
                        }
                    }
                });
            } else {
                // Remove immediately
                stage.remove_effect(effect);
                this._effects.delete('stage');
                
                if (!skipEvents) {
                    this.emit('effect-removed', -1, 'stage', true);
                }
            }
            
            console.log('[EffectManager] Stage effect removed successfully');
            return true;
            
        } catch (error) {
            console.error('[EffectManager] Failed to remove stage effect:', error);
            return false;
        }
    }
    
    // Monitor Effect Implementation (Phase 1: Basic support)
    async _applyMonitorEffect(monitorIndex, enabled, options = {}) {
        if (enabled) {
            return await this._addMonitorEffect(monitorIndex, options);
        } else {
            return await this._removeMonitorEffect(monitorIndex, options);
        }
    }
    
    async _addMonitorEffect(monitorIndex, options = {}) {
        const { animated = true, duration = this._animationSettings.duration, skipEvents = false } = options;
        
        try {
            const key = monitorIndex.toString();
            
            // Check if effect already exists
            if (this._effects.has(key)) {
                console.log(`[EffectManager] Monitor ${monitorIndex} effect already active`);
                return true;
            }
            
            // Get monitor-specific actor
            let targetActor = null;
            
            if (this._monitorManager) {
                // Phase 2: True per-monitor effects
                targetActor = this._monitorManager.getMonitorActor(monitorIndex);
                
                if (!targetActor) {
                    console.warn(`[EffectManager] No actor found for monitor ${monitorIndex}, falling back to stage`);
                    targetActor = Main.layoutManager.uiGroup;
                }
            } else {
                // Phase 1: Global stage fallback
                targetActor = Main.layoutManager.uiGroup;
            }
            
            // Create monitor-specific desaturate effect
            const effect = new Clutter.DesaturateEffect({
                factor: 0.0
            });
            
            // Apply effect to target actor
            targetActor.add_effect(effect);
            
            // Store effect reference with actor
            this._effects.set(key, {
                effect,
                actor: targetActor,
                monitorIndex,
                type: 'monitor'
            });
            
            if (animated && duration > 0) {
                effect.ease_property('factor', 1.0, {
                    duration: duration,
                    mode: this._animationSettings.easing,
                    onComplete: () => {
                        if (!skipEvents) {
                            this.emit('effect-applied', monitorIndex, 'monitor', true);
                        }
                    }
                });
            } else {
                effect.factor = 1.0;
                if (!skipEvents) {
                    this.emit('effect-applied', monitorIndex, 'monitor', true);
                }
            }
            
            console.log(`[EffectManager] Monitor ${monitorIndex} effect added successfully`);
            return true;
            
        } catch (error) {
            console.error(`[EffectManager] Failed to add monitor ${monitorIndex} effect:`, error);
            return false;
        }
    }
    
    async _removeMonitorEffect(monitorIndex, options = {}) {
        const { animated = true, duration = this._animationSettings.duration, skipEvents = false } = options;
        
        try {
            const key = monitorIndex.toString();
            const effectData = this._effects.get(key);
            
            if (!effectData) {
                console.log(`[EffectManager] No monitor ${monitorIndex} effect to remove`);
                return true;
            }
            
            // Handle both old and new effect storage formats
            const effect = effectData.effect || effectData;
            const actor = effectData.actor || Main.layoutManager.uiGroup;
            
            if (animated && duration > 0) {
                effect.ease_property('factor', 0.0, {
                    duration: duration,
                    mode: this._animationSettings.easing,
                    onComplete: () => {
                        try {
                            actor.remove_effect(effect);
                            this._effects.delete(key);
                            
                            if (!skipEvents) {
                                this.emit('effect-removed', monitorIndex, 'monitor', true);
                            }
                        } catch (removeError) {
                            console.warn(`[EffectManager] Failed to remove effect during cleanup:`, removeError);
                        }
                    }
                });
            } else {
                actor.remove_effect(effect);
                this._effects.delete(key);
                
                if (!skipEvents) {
                    this.emit('effect-removed', monitorIndex, 'monitor', true);
                }
            }
            
            console.log(`[EffectManager] Monitor ${monitorIndex} effect removed successfully`);
            return true;
            
        } catch (error) {
            console.error(`[EffectManager] Failed to remove monitor ${monitorIndex} effect:`, error);
            return false;
        }
    }
    
    async removeMonitorEffect(monitorIndex, options = {}) {
        return await this._removeMonitorEffect(monitorIndex, options);
    }
    
    // Helper methods
    _isPerMonitorMode() {
        if (!this._stateManager || !this._monitorManager) {
            return false;
        }
        return this._stateManager.getSetting('per-monitor-mode') === true;
    }
    
    // Operation Queue (for future use)
    async _queueOperation(operation) {
        return new Promise((resolve, reject) => {
            this._effectQueue.push({
                ...operation,
                resolve,
                reject
            });
            
            this._processQueue();
        });
    }
    
    async _processQueue() {
        if (this._processing || this._effectQueue.length === 0) {
            return;
        }
        
        this._processing = true;
        
        try {
            while (this._effectQueue.length > 0) {
                const operation = this._effectQueue.shift();
                
                try {
                    let result;
                    if (operation.type === 'monitor') {
                        result = await this._applyMonitorEffect(
                            operation.monitorIndex,
                            operation.enabled,
                            operation.options
                        );
                    }
                    
                    operation.resolve(result);
                    
                } catch (error) {
                    operation.reject(error);
                }
            }
        } finally {
            this._processing = false;
        }
    }
}