/**
 * Main Extension Entry Point for GNOME Shell Grayscale Toggle Extension
 * Modern Extension class pattern using ES6 modules
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { SettingsController } from './settingsController.js';
import { StateManager } from './stateManager.js';
import { EffectManager } from './effectManager.js';
import { UIController } from './uiController.js';
import { MonitorManager } from './monitorManager.js';

import type {
    GrayscaleExtensionMetadata,
    ExtensionComponent,
    ExtensionManager,
} from './types/extension.js';

// Component constructor interface
type ComponentConstructor = new (extension: GrayscaleExtension) => ExtensionComponent;

// Component definition interface
interface ComponentDefinition {
    name: string;
    class: ComponentConstructor;
}

// Signal connection interface
interface SignalConnection {
    object: any;
    id: number;
}

// Error handler interface
interface ErrorHandler {
    handleError: (error: Error, context?: string) => void;
}

export default class GrayscaleExtension extends Extension implements ExtensionManager {
    private _components: Map<string, ExtensionComponent>;
    private _initialized: boolean;
    private _errorHandler: ErrorHandler | null = null;
    private _signalConnections: SignalConnection[];

    declare metadata: GrayscaleExtensionMetadata;

    constructor(metadata: GrayscaleExtensionMetadata) {
        super(metadata);

        this._components = new Map();
        this._initialized = false;
        this._errorHandler = null;
        this._signalConnections = [];
    }

    enable(): void {
        try {
            console.log(`[${this.metadata.name}] Enabling extension...`);

            this._initializeErrorHandler();
            this._initializeComponents();
            this._connectSignals();
            this._loadInitialState();

            this._initialized = true;
            console.log(`[${this.metadata.name}] Extension enabled successfully`);
        } catch (error) {
            this._handleInitializationError(error as Error);
        }
    }

    disable(): void {
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

    getComponent(name: string): ExtensionComponent | null {
        return this._components.get(name) || null;
    }

    // ExtensionManager interface implementation
    get components(): Map<string, ExtensionComponent> {
        return new Map(this._components);
    }

    addComponent(name: string, component: ExtensionComponent): void {
        this._components.set(name, component);
    }

    removeComponent(name: string): void {
        const component = this._components.get(name);
        if (component && typeof component.destroy === 'function') {
            component.destroy();
        }
        this._components.delete(name);
    }

    enableAll(): void {
        for (const [name, component] of this._components) {
            if (typeof component.enable === 'function') {
                try {
                    component.enable();
                    console.log(`[${this.metadata.name}] ${name} enabled`);
                } catch (error) {
                    console.error(`[${this.metadata.name}] Failed to enable ${name}:`, error);
                }
            }
        }
    }

    disableAll(): void {
        for (const [name, component] of this._components) {
            if (typeof component.disable === 'function') {
                try {
                    component.disable();
                    console.log(`[${this.metadata.name}] ${name} disabled`);
                } catch (error) {
                    console.error(`[${this.metadata.name}] Failed to disable ${name}:`, error);
                }
            }
        }
    }

    // Component Management
    private _initializeComponents(): void {
        console.log(`[${this.metadata.name}] Initializing components...`);

        // Component initialization in dependency order
        const componentOrder: ComponentDefinition[] = [
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
                throw new Error(`Failed to create ${name}: ${(error as Error).message}`);
            }
        }

        // Asynchronous component initialization
        this._initializeComponentsAsync().catch(error => {
            this._handleInitializationError(error);
        });
    }

    private async _initializeComponentsAsync(): Promise<void> {
        console.log(`[${this.metadata.name}] Initializing components asynchronously...`);

        const initOrder = [
            'SettingsController',
            'MonitorManager',
            'StateManager',
            'EffectManager',
            'UIController',
        ];

        for (const componentName of initOrder) {
            const component = this._components.get(componentName);
            if (component && typeof component.enable === 'function') {
                try {
                    console.log(`[${this.metadata.name}] Initializing ${componentName}...`);
                    component.enable();
                    console.log(
                        `[${this.metadata.name}] ${componentName} initialized successfully`
                    );
                } catch (error) {
                    throw new Error(
                        `Failed to initialize ${componentName}: ${(error as Error).message}`
                    );
                }
            }
        }

        console.log(`[${this.metadata.name}] All components initialized successfully`);
    }

    private _destroyComponents(): void {
        console.log(`[${this.metadata.name}] Destroying components...`);

        // Destroy in reverse order
        const destroyOrder = [
            'UIController',
            'EffectManager',
            'StateManager',
            'MonitorManager',
            'SettingsController',
        ];

        for (const componentName of destroyOrder) {
            const component = this._components.get(componentName);
            if (component && typeof component.disable === 'function') {
                try {
                    console.log(`[${this.metadata.name}] Destroying ${componentName}...`);
                    component.disable();
                    console.log(`[${this.metadata.name}] ${componentName} destroyed successfully`);
                } catch (error) {
                    console.warn(
                        `[${this.metadata.name}] Error destroying ${componentName}:`,
                        error
                    );
                }
            }
        }

        this._components.clear();
        console.log(`[${this.metadata.name}] All components destroyed`);
    }

    // Signal Management
    private _connectSignals(): void {
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

    private _connectComponentSignals(): void {
        const stateManager = this.getComponent('StateManager');
        const effectManager = this.getComponent('EffectManager');
        const uiController = this.getComponent('UIController');
        const monitorManager = this.getComponent('MonitorManager');

        if (stateManager && effectManager) {
            // Connect state changes to effect applications
            const stateChangedId = (stateManager as any).connect(
                'state-changed',
                (manager: any, enabled: boolean, previous: boolean, options: any) => {
                    // Effect manager will handle this through its own signal connections
                    console.log(`[${this.metadata.name}] State changed: ${enabled}`);
                }
            );
            this._signalConnections.push({ object: stateManager, id: stateChangedId });
        }

        if (uiController) {
            // Connect UI toggle requests to state manager
            const toggleRequestedId = (uiController as any).connect(
                'toggle-requested',
                (controller: any, source: string) => {
                    console.log(`[${this.metadata.name}] Toggle requested from ${source}`);
                }
            );
            this._signalConnections.push({ object: uiController, id: toggleRequestedId });
        }

        if (effectManager) {
            // Connect effect application results
            const effectAppliedId = (effectManager as any).connect(
                'effect-applied',
                (manager: any, monitorIndex: number, type: string, success: boolean) => {
                    console.log(
                        `[${this.metadata.name}] Effect applied: monitor ${monitorIndex}, type ${type}, success: ${success}`
                    );
                }
            );
            this._signalConnections.push({ object: effectManager, id: effectAppliedId });
        }

        if (monitorManager && stateManager) {
            // Connect monitor changes to state synchronization
            const monitorAddedId = (monitorManager as any).connect(
                'monitor-added',
                (manager: any, monitorData: any) => {
                    console.log(`[${this.metadata.name}] Monitor added`);
                    (stateManager as any).syncMonitorStates().catch((error: Error) => {
                        console.error(
                            `[${this.metadata.name}] Failed to sync monitor states:`,
                            error
                        );
                    });
                }
            );
            this._signalConnections.push({ object: monitorManager, id: monitorAddedId });

            const monitorRemovedId = (monitorManager as any).connect(
                'monitor-removed',
                (manager: any, monitorIndex: number) => {
                    console.log(`[${this.metadata.name}] Monitor ${monitorIndex} removed`);
                    // State manager will preserve the monitor state for when it returns
                }
            );
            this._signalConnections.push({ object: monitorManager, id: monitorRemovedId });

            const monitorChangedId = (monitorManager as any).connect(
                'monitor-changed',
                (manager: any, monitorIndex: number, changeData: any) => {
                    console.log(`[${this.metadata.name}] Monitor ${monitorIndex} changed`);
                    (stateManager as any).syncMonitorStates().catch((error: Error) => {
                        console.error(
                            `[${this.metadata.name}] Failed to sync monitor states:`,
                            error
                        );
                    });
                }
            );
            this._signalConnections.push({ object: monitorManager, id: monitorChangedId });

            const monitorsReconfiguredId = (monitorManager as any).connect(
                'monitors-reconfigured',
                (manager: any, reconfigData: any) => {
                    console.log(`[${this.metadata.name}] Monitors reconfigured`);
                    (stateManager as any).syncMonitorStates().catch((error: Error) => {
                        console.error(
                            `[${this.metadata.name}] Failed to sync monitor states:`,
                            error
                        );
                    });
                }
            );
            this._signalConnections.push({ object: monitorManager, id: monitorsReconfiguredId });
        }
    }

    private _connectShellSignals(): void {
        // Connect to session mode changes for performance optimization
        const sessionModeId = (Main.sessionMode as any).connect('updated', () => {
            this._handleSessionModeChange();
        });
        this._signalConnections.push({ object: Main.sessionMode, id: sessionModeId });

        // Legacy monitor change handling (MonitorManager provides more detailed handling)
        const monitorChangedId = Main.layoutManager.connect('monitors-changed', () => {
            this._handleLegacyMonitorChange();
        });
        this._signalConnections.push({ object: Main.layoutManager, id: monitorChangedId });
    }

    private _disconnectSignals(): void {
        console.log(
            `[${this.metadata.name}] Disconnecting ${this._signalConnections.length} signals...`
        );

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
    private _handleSessionModeChange(): void {
        console.log(
            `[${this.metadata.name}] Session mode changed: ${(Main.sessionMode as any).currentMode}`
        );

        const effectManager = this.getComponent('EffectManager');
        if (effectManager) {
            // Suspend effects in lock screen or other restricted modes
            if ((Main.sessionMode as any).isLocked) {
                (effectManager as any).suspendEffects().catch((error: Error) => {
                    console.warn(`[${this.metadata.name}] Failed to suspend effects:`, error);
                });
            } else {
                (effectManager as any).resumeEffects().catch((error: Error) => {
                    console.warn(`[${this.metadata.name}] Failed to resume effects:`, error);
                });
            }
        }
    }

    private _handleLegacyMonitorChange(): void {
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
            const currentState = (stateManager as any).getGrayscaleState();
            if (currentState) {
                (effectManager as any)
                    .applyGlobalEffect(currentState, {
                        animated: false,
                        force: true,
                    })
                    .catch((error: Error) => {
                        console.warn(
                            `[${this.metadata.name}] Failed to re-apply effect after monitor change:`,
                            error
                        );
                    });
            }
        }
    }

    // State Management
    private _loadInitialState(): void {
        console.log(`[${this.metadata.name}] Loading initial state...`);

        const settingsController = this.getComponent('SettingsController');
        const stateManager = this.getComponent('StateManager');

        if (settingsController && stateManager) {
            // Load auto-enable setting
            const autoEnable = (settingsController as any).getSetting('auto-enable-on-startup');
            if (autoEnable) {
                console.log(`[${this.metadata.name}] Auto-enable is active, enabling grayscale...`);

                // Delay auto-enable to allow all components to fully initialize
                setTimeout(() => {
                    (stateManager as any)
                        .setGrayscaleState(true, {
                            source: 'auto-enable',
                            animated: true,
                        })
                        .catch((error: Error) => {
                            console.warn(
                                `[${this.metadata.name}] Failed to auto-enable grayscale:`,
                                error
                            );
                        });
                }, 1000);
            }

            // Load and restore previous session state
            const globalEnabled = (settingsController as any).getSetting('global-enabled');
            if (globalEnabled && !autoEnable) {
                console.log(
                    `[${this.metadata.name}] Restoring previous session state: ${globalEnabled}`
                );

                setTimeout(() => {
                    (stateManager as any)
                        .setGrayscaleState(globalEnabled, {
                            source: 'session-restore',
                            animated: false, // No animation on session restore
                        })
                        .catch((error: Error) => {
                            console.warn(
                                `[${this.metadata.name}] Failed to restore session state:`,
                                error
                            );
                        });
                }, 500);
            }
        }
    }

    // Error Handling
    private _initializeErrorHandler(): void {
        this._errorHandler = {
            handleError: (error: Error, context: string = 'unknown') => {
                console.error(`[${this.metadata.name}] Error in ${context}:`, error);

                // Show user notification for critical errors
                if ((error as any).category === 'critical') {
                    const uiController = this.getComponent('UIController');
                    if (
                        uiController &&
                        typeof (uiController as any)._showErrorNotification === 'function'
                    ) {
                        (uiController as any)._showErrorNotification(
                            'Extension Error',
                            `A critical error occurred: ${error.message}`
                        );
                    }
                }
            },
        };
    }

    private _handleInitializationError(error: Error): void {
        console.error(`[${this.metadata.name}] Extension initialization failed:`, error);

        // Try to cleanup any partially initialized state
        try {
            this._destroyComponents();
        } catch (cleanupError) {
            console.error(
                `[${this.metadata.name}] Cleanup after initialization failure also failed:`,
                cleanupError
            );
        }

        // Show error notification
        (Main as any).notifyError(
            `${this.metadata.name} Failed`,
            `Extension failed to initialize: ${error.message}`
        );

        this._initialized = false;
    }

    // Public API for testing and debugging
    getMetadata(): GrayscaleExtensionMetadata {
        return this.metadata;
    }

    getState(): any {
        const stateManager = this.getComponent('StateManager');
        return stateManager ? (stateManager as any).getState() : null;
    }

    async testToggle(): Promise<boolean> {
        const uiController = this.getComponent('UIController');
        if (uiController && typeof (uiController as any).testToggle === 'function') {
            return await (uiController as any).testToggle();
        }
        throw new Error('UIController not available or testToggle method not found');
    }

    dumpDebugInfo(): void {
        console.log(`[${this.metadata.name}] === DEBUG INFO ===`);
        console.log('Extension initialized:', this._initialized);
        console.log('Components:', Array.from(this._components.keys()));
        console.log('Signal connections:', this._signalConnections.length);

        // Dump component debug info
        for (const [name, component] of this._components) {
            console.log(`--- ${name} ---`);
            if (typeof (component as any).dumpState === 'function') {
                (component as any).dumpState();
            } else if (typeof (component as any).dumpSettings === 'function') {
                (component as any).dumpSettings();
            } else if (typeof (component as any).dumpShortcuts === 'function') {
                (component as any).dumpShortcuts();
            }
        }

        console.log(`[${this.metadata.name}] === END DEBUG INFO ===`);
    }
}
