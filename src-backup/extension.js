// Main Extension Entry Point for GNOME Shell Grayscale Toggle Extension
// Modern Extension class pattern using ES6 modules

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { SettingsController } from './settingsController.js';
import { StateManager } from './stateManager.js';
import { EffectManager } from './effectManager.js';
import { UIController } from './uiController.js';
import { MonitorManager } from './monitorManager.js';

export default class GrayscaleExtension extends Extension {
    constructor(metadata) {
        super(metadata);

        this._components = new Map();
        this._initialized = false;
        this._errorHandler = null;
        this._signalConnections = [];
    }

    enable() {
        try {
            console.log(`[${this.metadata.name}] Enabling extension...`);

            this._initializeErrorHandler();
            this._initializeComponents();
            this._connectSignals();
            this._loadInitialState();

            this._initialized = true;
            console.log(`[${this.metadata.name}] Extension enabled successfully`);

        } catch (error) {
            this._handleInitializationError(error);
        }
    }

    disable() {
        if (!this._initialized) {
            return;
        }

        console.log(`[${this.metadata.name}] Disabling extension...`);

        try {
            this._disconnectSignals();
            this._destroyComponents();
            this._initialized = false;

            console.log(`[${this.metadata.name}] Extension disabled successfully`);

        } catch (error) {
            console.error(`[${this.metadata.name}] Error during disable:`, error);
        }
    }

    getComponent(name) {
        return this._components.get(name) || null;
    }

    // Component Management
    _initializeComponents() {
        console.log(`[${this.metadata.name}] Initializing components...`);

        // Component initialization in dependency order
        const componentOrder = [
            { name: 'SettingsController', class: SettingsController },
            { name: 'MonitorManager', class: MonitorManager },
            { name: 'StateManager', class: StateManager },
            { name: 'EffectManager', class: EffectManager },
            { name: 'UIController', class: UIController },
        ];

        // Synchronous component creation
        for (const { name, class: ComponentClass } of componentOrder) {
            try {
                console.log(`[${this.metadata.name}] Creating ${name}...`);
                const instance = new ComponentClass(this);
                this._components.set(name, instance);
                console.log(`[${this.metadata.name}] ${name} created successfully`);
            } catch (error) {
                throw new Error(`Failed to create ${name}: ${error.message}`);
            }
        }

        // Asynchronous component initialization
        this._initializeComponentsAsync().catch(error => {
            this._handleInitializationError(error);
        });
    }

    async _initializeComponentsAsync() {
        console.log(`[${this.metadata.name}] Initializing components asynchronously...`);

        const initOrder = ['SettingsController', 'MonitorManager', 'StateManager', 'EffectManager', 'UIController'];

        for (const componentName of initOrder) {
            const component = this._components.get(componentName);
            if (component && typeof component.initialize === 'function') {
                try {
                    console.log(`[${this.metadata.name}] Initializing ${componentName}...`);
                    await component.initialize();
                    console.log(`[${this.metadata.name}] ${componentName} initialized successfully`);
                } catch (error) {
                    throw new Error(`Failed to initialize ${componentName}: ${error.message}`);
                }
            }
        }

        console.log(`[${this.metadata.name}] All components initialized successfully`);
    }

    _destroyComponents() {
        console.log(`[${this.metadata.name}] Destroying components...`);

        // Destroy in reverse order
        const destroyOrder = ['UIController', 'EffectManager', 'StateManager', 'MonitorManager', 'SettingsController'];

        for (const componentName of destroyOrder) {
            const component = this._components.get(componentName);
            if (component && typeof component.destroy === 'function') {
                try {
                    console.log(`[${this.metadata.name}] Destroying ${componentName}...`);
                    component.destroy();
                    console.log(`[${this.metadata.name}] ${componentName} destroyed successfully`);
                } catch (error) {
                    console.warn(`[${this.metadata.name}] Error destroying ${componentName}:`, error);
                }
            }
        }

        this._components.clear();
        console.log(`[${this.metadata.name}] All components destroyed`);
    }

    // Signal Management
    _connectSignals() {
        console.log(`[${this.metadata.name}] Connecting signals...`);

        try {
            // Connect to component signals for cross-component communication
            this._connectComponentSignals();

            // Connect to GNOME Shell signals
            this._connectShellSignals();

            console.log(`[${this.metadata.name}] Signals connected successfully`);

        } catch (error) {
            console.error(`[${this.metadata.name}] Failed to connect signals:`, error);
        }
    }

    _connectComponentSignals() {
        const stateManager = this.getComponent('StateManager');
        const effectManager = this.getComponent('EffectManager');
        const uiController = this.getComponent('UIController');
        const monitorManager = this.getComponent('MonitorManager');

        if (stateManager && effectManager) {
            // Connect state changes to effect applications
            const stateChangedId = stateManager.connect('state-changed',
                (manager, enabled, previous, options) => {
                    // Effect manager will handle this through its own signal connections
                    console.log(`[${this.metadata.name}] State changed: ${enabled}`);
                },
            );
            this._signalConnections.push({ object: stateManager, id: stateChangedId });
        }

        if (uiController) {
            // Connect UI toggle requests to state manager
            const toggleRequestedId = uiController.connect('toggle-requested',
                (controller, source) => {
                    console.log(`[${this.metadata.name}] Toggle requested from ${source}`);
                },
            );
            this._signalConnections.push({ object: uiController, id: toggleRequestedId });
        }

        if (effectManager) {
            // Connect effect application results
            const effectAppliedId = effectManager.connect('effect-applied',
                (manager, monitorIndex, type, success) => {
                    console.log(`[${this.metadata.name}] Effect applied: monitor ${monitorIndex}, type ${type}, success: ${success}`);
                },
            );
            this._signalConnections.push({ object: effectManager, id: effectAppliedId });
        }

        if (monitorManager && stateManager) {
            // Connect monitor changes to state synchronization
            const monitorAddedId = monitorManager.connect('monitor-added',
                (manager, monitorData) => {
                    console.log(`[${this.metadata.name}] Monitor added`);
                    stateManager.syncMonitorStates().catch(error => {
                        console.error(`[${this.metadata.name}] Failed to sync monitor states:`, error);
                    });
                },
            );
            this._signalConnections.push({ object: monitorManager, id: monitorAddedId });

            const monitorRemovedId = monitorManager.connect('monitor-removed',
                (manager, monitorIndex) => {
                    console.log(`[${this.metadata.name}] Monitor ${monitorIndex} removed`);
                    // State manager will preserve the monitor state for when it returns
                },
            );
            this._signalConnections.push({ object: monitorManager, id: monitorRemovedId });

            const monitorChangedId = monitorManager.connect('monitor-changed',
                (manager, monitorIndex, changeData) => {
                    console.log(`[${this.metadata.name}] Monitor ${monitorIndex} changed`);
                    stateManager.syncMonitorStates().catch(error => {
                        console.error(`[${this.metadata.name}] Failed to sync monitor states:`, error);
                    });
                },
            );
            this._signalConnections.push({ object: monitorManager, id: monitorChangedId });

            const monitorsReconfiguredId = monitorManager.connect('monitors-reconfigured',
                (manager, reconfigData) => {
                    console.log(`[${this.metadata.name}] Monitors reconfigured`);
                    stateManager.syncMonitorStates().catch(error => {
                        console.error(`[${this.metadata.name}] Failed to sync monitor states:`, error);
                    });
                },
            );
            this._signalConnections.push({ object: monitorManager, id: monitorsReconfiguredId });
        }
    }

    _connectShellSignals() {
        // Connect to session mode changes for performance optimization
        const sessionModeId = Main.sessionMode.connect('updated', () => {
            this._handleSessionModeChange();
        });
        this._signalConnections.push({ object: Main.sessionMode, id: sessionModeId });

        // Legacy monitor change handling (MonitorManager provides more detailed handling)
        const monitorChangedId = Main.layoutManager.connect('monitors-changed', () => {
            this._handleLegacyMonitorChange();
        });
        this._signalConnections.push({ object: Main.layoutManager, id: monitorChangedId });
    }

    _disconnectSignals() {
        console.log(`[${this.metadata.name}] Disconnecting ${this._signalConnections.length} signals...`);

        for (const connection of this._signalConnections) {
            try {
                if (connection.object && connection.id) {
                    connection.object.disconnect(connection.id);
                }
            } catch (error) {
                console.warn(`[${this.metadata.name}] Failed to disconnect signal:`, error);
            }
        }

        this._signalConnections = [];
        console.log(`[${this.metadata.name}] All signals disconnected`);
    }

    // Event Handlers
    _handleSessionModeChange() {
        console.log(`[${this.metadata.name}] Session mode changed: ${Main.sessionMode.currentMode}`);

        const effectManager = this.getComponent('EffectManager');
        if (effectManager) {
            // Suspend effects in lock screen or other restricted modes
            if (Main.sessionMode.isLocked) {
                effectManager.suspendEffects().catch(error => {
                    console.warn(`[${this.metadata.name}] Failed to suspend effects:`, error);
                });
            } else {
                effectManager.resumeEffects().catch(error => {
                    console.warn(`[${this.metadata.name}] Failed to resume effects:`, error);
                });
            }
        }
    }

    _handleLegacyMonitorChange() {
        console.log(`[${this.metadata.name}] Legacy monitor configuration changed`);

        // This is a fallback for cases where MonitorManager isn't available
        const monitorManager = this.getComponent('MonitorManager');
        if (monitorManager) {
            // MonitorManager will handle the detailed monitor change processing
            // This event is handled by the MonitorManager's hotplug system
            return;
        }

        // Fallback behavior for when MonitorManager is not available
        const effectManager = this.getComponent('EffectManager');
        const stateManager = this.getComponent('StateManager');

        if (effectManager && stateManager) {
            // Re-apply current state to handle monitor changes
            const currentState = stateManager.getGrayscaleState();
            if (currentState) {
                effectManager.applyGlobalEffect(currentState, {
                    animated: false,
                    force: true,
                }).catch(error => {
                    console.warn(`[${this.metadata.name}] Failed to re-apply effect after monitor change:`, error);
                });
            }
        }
    }

    // State Management
    _loadInitialState() {
        console.log(`[${this.metadata.name}] Loading initial state...`);

        const settingsController = this.getComponent('SettingsController');
        const stateManager = this.getComponent('StateManager');

        if (settingsController && stateManager) {
            // Load auto-enable setting
            const autoEnable = settingsController.getSetting('auto-enable-on-startup');
            if (autoEnable) {
                console.log(`[${this.metadata.name}] Auto-enable is active, enabling grayscale...`);

                // Delay auto-enable to allow all components to fully initialize
                setTimeout(() => {
                    stateManager.setGrayscaleState(true, {
                        source: 'auto-enable',
                        animated: true,
                    }).catch(error => {
                        console.warn(`[${this.metadata.name}] Failed to auto-enable grayscale:`, error);
                    });
                }, 1000);
            }

            // Load and restore previous session state
            const globalEnabled = settingsController.getSetting('global-enabled');
            if (globalEnabled && !autoEnable) {
                console.log(`[${this.metadata.name}] Restoring previous session state: ${globalEnabled}`);

                setTimeout(() => {
                    stateManager.setGrayscaleState(globalEnabled, {
                        source: 'session-restore',
                        animated: false, // No animation on session restore
                    }).catch(error => {
                        console.warn(`[${this.metadata.name}] Failed to restore session state:`, error);
                    });
                }, 500);
            }
        }
    }

    // Error Handling
    _initializeErrorHandler() {
        this._errorHandler = {
            handleError: (error, context = 'unknown') => {
                console.error(`[${this.metadata.name}] Error in ${context}:`, error);

                // Show user notification for critical errors
                if (error.category === 'critical') {
                    const uiController = this.getComponent('UIController');
                    if (uiController && typeof uiController._showErrorNotification === 'function') {
                        uiController._showErrorNotification(
                            'Extension Error',
                            `A critical error occurred: ${error.message}`,
                        );
                    }
                }
            },
        };
    }

    _handleInitializationError(error) {
        console.error(`[${this.metadata.name}] Extension initialization failed:`, error);

        // Try to cleanup any partially initialized state
        try {
            this._destroyComponents();
        } catch (cleanupError) {
            console.error(`[${this.metadata.name}] Cleanup after initialization failure also failed:`, cleanupError);
        }

        // Show error notification
        Main.notifyError(
            `${this.metadata.name} Failed`,
            `Extension failed to initialize: ${error.message}`,
        );

        this._initialized = false;
    }

    // Public API for testing and debugging
    getMetadata() {
        return this.metadata;
    }

    getState() {
        const stateManager = this.getComponent('StateManager');
        return stateManager ? stateManager.getState() : null;
    }

    async testToggle() {
        const uiController = this.getComponent('UIController');
        if (uiController && typeof uiController.testToggle === 'function') {
            return await uiController.testToggle();
        }
        throw new Error('UIController not available or testToggle method not found');
    }

    dumpDebugInfo() {
        console.log(`[${this.metadata.name}] === DEBUG INFO ===`);
        console.log('Extension initialized:', this._initialized);
        console.log('Components:', Array.from(this._components.keys()));
        console.log('Signal connections:', this._signalConnections.length);

        // Dump component debug info
        for (const [name, component] of this._components) {
            console.log(`--- ${name} ---`);
            if (typeof component.dumpState === 'function') {
                component.dumpState();
            } else if (typeof component.dumpSettings === 'function') {
                component.dumpSettings();
            } else if (typeof component.dumpShortcuts === 'function') {
                component.dumpShortcuts();
            }
        }

        console.log(`[${this.metadata.name}] === END DEBUG INFO ===`);
    }
}
