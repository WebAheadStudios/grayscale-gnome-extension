/**
 * Main Extension Entry Point for GNOME Shell Grayscale Toggle Extension
 * Modern Extension class pattern using ES6 modules
 */

import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { EffectManager } from './effectManager.js';
import { LogCategory, Logger, LogLevel } from './infrastructure/Logger.js';
import { MonitorManager } from './monitorManager.js';
import { SettingsController } from './settingsController.js';
import { StateManager } from './stateManager.js';
import { UIController } from './uiController.js';

import type {
    ExtensionComponent,
    ExtensionManager,
    GrayscaleExtensionMetadata,
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

// Simple logger interface used throughout extension.ts
// Backed by GrayscaleLogger (src/infrastructure/Logger.ts); maps .log() → .info()
interface ExtensionLogger {
    log: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
}

export default class GrayscaleExtension extends Extension implements ExtensionManager {
    private _components: Map<string, ExtensionComponent>;
    private _initialized: boolean;
    private _errorHandler: ErrorHandler | null = null;
    private _signalConnections: SignalConnection[];
    private _logger: InstanceType<typeof Logger> | null = null;
    // No-op default so calls before enable() are safe; replaced with real logger in enable().
    private _log: ExtensionLogger = { log: () => {}, warn: () => {}, error: () => {} };
    // GLib timer source IDs — stored so we can cancel them in disable() (review guideline R4)
    private _autoEnableTimerId: number | null = null;
    private _sessionRestoreTimerId: number | null = null;

    declare metadata: GrayscaleExtensionMetadata;

    constructor(metadata: GrayscaleExtensionMetadata) {
        super(metadata);

        // Constructor MUST NOT create GObject instances (review guideline R1).
        // Logger (a GObject subclass) is instantiated in enable() instead.
        this._components = new Map();
        this._initialized = false;
        this._errorHandler = null;
        this._signalConnections = [];
    }

    override enable(): void {
        // Instantiate GObject Logger here (not in constructor — review guideline R1).
        // Extension.getLogger() exists only in GNOME Shell 48+; use infrastructure
        // Logger directly so this works on GNOME 45/46.
        this._logger = new Logger({ level: LogLevel.Info, enableConsole: true });
        const _componentLog = this._logger.createComponentLogger(
            this.metadata.uuid ?? 'grayscale-toggle@webaheadstudios.com',
            LogCategory.System
        );
        this._log = {
            log: (msg: string) => _componentLog.info(msg),
            warn: (msg: string) => _componentLog.warn(msg),
            error: (msg: string) => _componentLog.error(msg),
        };

        try {
            this._log.log('Enabling extension...');

            this._initializeErrorHandler();
            this._initializeComponents();
            this._connectSignals();
            this._loadInitialState();

            this._initialized = true;
            this._log.log('Extension enabled successfully');
        } catch (error) {
            this._handleInitializationError(error as Error);
        }
    }

    override disable(): void {
        if (!this._initialized) {
            return;
        }

        this._log.log('Disabling extension...');

        // Cancel any pending one-shot timers before tearing down components
        // (review guideline R4 — all GLib source IDs must be removed in disable).
        if (this._autoEnableTimerId) {
            GLib.source_remove(this._autoEnableTimerId);
            this._autoEnableTimerId = null;
        }
        if (this._sessionRestoreTimerId) {
            GLib.source_remove(this._sessionRestoreTimerId);
            this._sessionRestoreTimerId = null;
        }

        try {
            this._disconnectSignals();
            this._destroyComponents();
            this._initialized = false;

            this._log.log('Extension disabled successfully');
        } catch (error) {
            this._log.error(`Error during disable: ${error}`);
        }

        // Flush and destroy the logger last so all disable messages are captured
        this._logger?.destroy();
        this._logger = null;
        // Reset _log to no-op so any post-disable calls are safe
        this._log = { log: () => {}, warn: () => {}, error: () => {} };
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
                    this._log.log(`${name} enabled`);
                } catch (error) {
                    this._log.error(`Failed to enable ${name}: ${error}`);
                }
            }
        }
    }

    disableAll(): void {
        for (const [name, component] of this._components) {
            if (typeof component.disable === 'function') {
                try {
                    component.disable();
                    this._log.log(`${name} disabled`);
                } catch (error) {
                    this._log.error(`Failed to disable ${name}: ${error}`);
                }
            }
        }
    }

    // Component Management
    private _initializeComponents(): void {
        this._log.log('Initializing components...');

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
                this._log.log(`Creating ${name}...`);
                const instance = new ComponentClass(this);
                this._components.set(name, instance);
                this._log.log(`${name} created successfully`);
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
        this._log.log('Initializing components asynchronously...');

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
                    this._log.log(`Initializing ${componentName}...`);
                    component.enable();
                    this._log.log(`${componentName} initialized successfully`);
                } catch (error) {
                    throw new Error(
                        `Failed to initialize ${componentName}: ${(error as Error).message}`
                    );
                }
            }
        }

        this._log.log('All components initialized successfully');
    }

    private _destroyComponents(): void {
        this._log.log('Destroying components...');

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
                    this._log.log(`Destroying ${componentName}...`);
                    component.disable();
                    this._log.log(`${componentName} destroyed successfully`);
                } catch (error) {
                    this._log.warn(`Error destroying ${componentName}: ${error}`);
                }
            }
        }

        this._components.clear();
        this._log.log('All components destroyed');
    }

    // Signal Management
    private _connectSignals(): void {
        this._log.log('Connecting signals...');

        try {
            // Connect to component signals for cross-component communication
            this._connectComponentSignals();

            // Connect to GNOME Shell signals
            this._connectShellSignals();

            this._log.log('Signals connected successfully');
        } catch (error) {
            this._log.error(`Failed to connect signals: ${error}`);
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
                (manager: any, enabled: boolean, _previous: boolean, _options: any) => {
                    // Effect manager will handle this through its own signal connections
                    this._log.log(`State changed: ${enabled}`);
                }
            );
            this._signalConnections.push({ object: stateManager, id: stateChangedId });
        }

        if (uiController) {
            // Connect UI toggle requests to state manager
            const toggleRequestedId = (uiController as any).connect(
                'toggle-requested',
                (controller: any, source: string) => {
                    this._log.log(`Toggle requested from ${source}`);
                }
            );
            this._signalConnections.push({ object: uiController, id: toggleRequestedId });
        }

        if (effectManager) {
            // Connect effect application results
            const effectAppliedId = (effectManager as any).connect(
                'effect-applied',
                (manager: any, monitorIndex: number, type: string, success: boolean) => {
                    this._log.log(
                        `Effect applied: monitor ${monitorIndex}, type ${type}, success: ${success}`
                    );
                }
            );
            this._signalConnections.push({ object: effectManager, id: effectAppliedId });
        }

        if (monitorManager && stateManager) {
            // Connect monitor changes to state synchronization
            const monitorAddedId = (monitorManager as any).connect(
                'monitor-added',
                (_manager: any, _monitorData: any) => {
                    this._log.log('Monitor added');
                    (stateManager as any).syncMonitorStates().catch((error: Error) => {
                        this._log.error(`Failed to sync monitor states: ${error}`);
                    });
                }
            );
            this._signalConnections.push({ object: monitorManager, id: monitorAddedId });

            const monitorRemovedId = (monitorManager as any).connect(
                'monitor-removed',
                (manager: any, monitorIndex: number) => {
                    this._log.log(`Monitor ${monitorIndex} removed`);
                    // State manager will preserve the monitor state for when it returns
                }
            );
            this._signalConnections.push({ object: monitorManager, id: monitorRemovedId });

            const monitorChangedId = (monitorManager as any).connect(
                'monitor-changed',
                (manager: any, monitorIndex: number, _changeData: any) => {
                    this._log.log(`Monitor ${monitorIndex} changed`);
                    (stateManager as any).syncMonitorStates().catch((error: Error) => {
                        this._log.error(`Failed to sync monitor states: ${error}`);
                    });
                }
            );
            this._signalConnections.push({ object: monitorManager, id: monitorChangedId });

            const monitorsReconfiguredId = (monitorManager as any).connect(
                'monitors-reconfigured',
                (_manager: any, _reconfigData: any) => {
                    this._log.log('Monitors reconfigured');
                    (stateManager as any).syncMonitorStates().catch((error: Error) => {
                        this._log.error(`Failed to sync monitor states: ${error}`);
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
        this._log.log(`Disconnecting ${this._signalConnections.length} signals...`);

        for (const connection of this._signalConnections) {
            try {
                if (connection.object && connection.id) {
                    connection.object.disconnect(connection.id);
                }
            } catch (error) {
                this._log.warn(`Failed to disconnect signal: ${error}`);
            }
        }

        this._signalConnections = [];
        this._log.log('All signals disconnected');
    }

    // Event Handlers
    private _handleSessionModeChange(): void {
        this._log.log(`Session mode changed: ${(Main.sessionMode as any).currentMode}`);

        const effectManager = this.getComponent('EffectManager');
        if (effectManager) {
            // Suspend effects in lock screen or other restricted modes
            if ((Main.sessionMode as any).isLocked) {
                (effectManager as any).suspendEffects().catch((error: Error) => {
                    this._log.warn(`Failed to suspend effects: ${error}`);
                });
            } else {
                (effectManager as any).resumeEffects().catch((error: Error) => {
                    this._log.warn(`Failed to resume effects: ${error}`);
                });
            }
        }
    }

    private _handleLegacyMonitorChange(): void {
        this._log.log('Legacy monitor configuration changed');

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
                        this._log.warn(`Failed to re-apply effect after monitor change: ${error}`);
                    });
            }
        }
    }

    // State Management
    private _loadInitialState(): void {
        this._log.log('Loading initial state...');

        const settingsController = this.getComponent('SettingsController');
        const stateManager = this.getComponent('StateManager');

        if (settingsController && stateManager) {
            // Load auto-enable setting
            const autoEnable = (settingsController as any).getSetting('auto-enable-on-startup');
            if (autoEnable) {
                this._log.log('Auto-enable is active, enabling grayscale...');

                // Delay auto-enable to allow all components to fully initialize.
                // Store the source ID so disable() can cancel this timer if it
                // fires after the extension is disabled (review guideline R4).
                this._autoEnableTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                    this._autoEnableTimerId = null;
                    (stateManager as any)
                        .setGrayscaleState(true, {
                            source: 'auto-enable',
                            animated: true,
                        })
                        .catch((error: Error) => {
                            this._log.warn(`Failed to auto-enable grayscale: ${error}`);
                        });
                    return GLib.SOURCE_REMOVE;
                });
            }

            // Load and restore previous session state
            const globalEnabled = (settingsController as any).getSetting('global-enabled');
            if (globalEnabled && !autoEnable) {
                this._log.log(`Restoring previous session state: ${globalEnabled}`);

                // Store the source ID for the same reason as _autoEnableTimerId above.
                this._sessionRestoreTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                    this._sessionRestoreTimerId = null;
                    (stateManager as any)
                        .setGrayscaleState(globalEnabled, {
                            source: 'session-restore',
                            animated: false, // No animation on session restore
                        })
                        .catch((error: Error) => {
                            this._log.warn(`Failed to restore session state: ${error}`);
                        });
                    return GLib.SOURCE_REMOVE;
                });
            }
        }
    }

    // Error Handling
    private _initializeErrorHandler(): void {
        this._errorHandler = {
            handleError: (error: Error, context = 'unknown') => {
                this._log.error(`Error in ${context}: ${error}`);

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
        this._log.error(`Extension initialization failed: ${error}`);

        // Try to cleanup any partially initialized state
        try {
            this._destroyComponents();
        } catch (cleanupError) {
            this._log.error(`Cleanup after initialization failure also failed: ${cleanupError}`);
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
        this._log.log('=== DEBUG INFO ===');
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

        this._log.log('=== END DEBUG INFO ===');
    }
}
