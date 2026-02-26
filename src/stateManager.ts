/**
 * State Manager for GNOME Shell Grayscale Toggle Extension
 * Central state coordination, settings persistence, and event publishing
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import type { ExtensionComponent } from './types/extension.js';
import type { MonitorInfo } from './types/monitors.js';
import type {
    ExtensionState,
    StateManager as IStateManager,
    StateChangeEvent,
} from './types/state.js';

// Extension interface for component access
interface Extension {
    getComponent(name: string): any;
}

// Transaction interface
interface Transaction {
    id: string;
    operation: string;
    data: Record<string, any>;
    timestamp: number;
    state: ExtensionState;
}

// State operation options
interface StateOperationOptions {
    skipValidation?: boolean;
    skipPersistence?: boolean;
    skipEvents?: boolean;
    source?: string;
    animated?: boolean;
}

// Performance metrics
interface PerformanceMetrics {
    toggleTimes: number[];
    errorCounts: Map<string, number>;
}

// Validation rule
type ValidationRule<T = unknown> = (value: T) => boolean;

export const StateManager = GObject.registerClass(
    {
        GTypeName: 'GrayscaleStateManager',
        Signals: {
            'state-changed': {
                param_types: [GObject.TYPE_BOOLEAN, GObject.TYPE_BOOLEAN, GObject.TYPE_VARIANT],
            },
            'monitor-state-changed': {
                param_types: [GObject.TYPE_INT, GObject.TYPE_BOOLEAN, GObject.TYPE_BOOLEAN],
            },
            'settings-changed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_VARIANT],
            },
        },
    },
    class StateManager extends GObject.Object implements IStateManager, ExtensionComponent {
        private _extension: Extension;
        private _state: ExtensionState;
        private _settingsController: any = null;
        private _monitorManager: any = null;
        private _persistenceTimer: any = null;
        private _transactionLog: Transaction[];
        private _stateValidators: Map<string, ValidationRule>;
        private _performanceMetrics: PerformanceMetrics;
        private _initialized: boolean;

        constructor(extension: Extension) {
            super();

            this._extension = extension;
            this._state = this._createInitialState();
            this._settingsController = null;
            this._persistenceTimer = null;
            this._transactionLog = [];
            this._stateValidators = new Map();
            this._performanceMetrics = {
                toggleTimes: [],
                errorCounts: new Map(),
            };
            this._initialized = false;

            this._setupValidators();
        }

        // Initialization
        async initialize(): Promise<boolean> {
            if (this._initialized) {
                return true;
            }

            try {
                this._settingsController = this._extension.getComponent('SettingsController');
                this._monitorManager = this._extension.getComponent('MonitorManager');

                if (!this._settingsController) {
                    throw new Error('SettingsController component not available');
                }

                // MonitorManager is optional but provides enhanced functionality
                if (!this._monitorManager) {
                    console.warn(
                        '[StateManager] MonitorManager not available, using basic monitor support'
                    );
                }

                // Load initial state from settings
                await this.loadState();

                // Connect to settings changes
                this._settingsController.connect(
                    'setting-changed',
                    (controller: any, key: string, variant: GLib.Variant) =>
                        this._handleSettingChange(key, variant)
                );

                this._initialized = true;
                console.log('[StateManager] Initialized successfully');
                return true;
            } catch (error) {
                console.error('[StateManager] Initialization failed:', error);
                throw error;
            }
        }

        enable(): void {
            this.initialize().catch(error => {
                console.error('[StateManager] Failed to enable:', error);
            });
        }

        disable(): void {
            this.destroy();
        }

        destroy(): void {
            if (!this._initialized) {
                return;
            }

            // Save current state before destruction
            this.saveState().catch(error => {
                console.warn('[StateManager] Failed to save state during destruction:', error);
            });

            // Cancel timers
            if (this._persistenceTimer) {
                GLib.source_remove(this._persistenceTimer);
                this._persistenceTimer = null;
            }

            // Clear data
            this._settingsController = null;
            this._monitorManager = null;
            this._stateValidators.clear();
            this._transactionLog = [];
            this._initialized = false;

            console.log('[StateManager] Destroyed successfully');
        }

        // IStateManager implementation
        get state(): ExtensionState {
            return JSON.parse(JSON.stringify(this._state)); // Return deep copy
        }

        toggle(): void {
            this.toggleGrayscaleState().catch(error => {
                console.error('[StateManager] Failed to toggle state:', error);
            });
        }

        updateSettings(settings: Partial<any>): void {
            Object.entries(settings).forEach(([key, value]) => {
                this.updateSetting(key, value).catch(error => {
                    console.error(`[StateManager] Failed to update setting ${key}:`, error);
                });
            });
        }

        updateMonitors(_monitors: MonitorInfo[]): void {
            this.syncMonitorStates().catch(error => {
                console.error('[StateManager] Failed to update monitors:', error);
            });
        }

        updateEffect(monitorIndex: number, effect: any): void {
            // Update effect state in the effects map
            this._state.effects.set(monitorIndex, {
                ...this._state.effects.get(monitorIndex),
                isActive: effect.isActive || false,
                config: effect.config || {},
                monitorIndex,
            });
        }

        connectSignal(signal: string, callback: (event: StateChangeEvent) => void): number {
            return (super.connect as any)(signal, callback);
        }

        disconnectSignal(id: number): void {
            (super.disconnect as any)(id);
        }

        reset(): void {
            this._state = this._createInitialState();
            this.saveState().catch(error => {
                console.error('[StateManager] Failed to save reset state:', error);
            });
        }

        // Global State API
        getGrayscaleState(): boolean {
            return this._state?.isActive || false;
        }

        async setGrayscaleState(
            enabled: boolean,
            options: StateOperationOptions = {}
        ): Promise<boolean> {
            const {
                skipValidation = false,
                skipPersistence = false,
                skipEvents = false,
                source = 'api',
                animated = true,
            } = options;

            if (!this._initialized) {
                throw new Error('StateManager not initialized');
            }

            // Performance tracking
            const startTime = GLib.get_monotonic_time() / 1000;

            try {
                // Validation
                if (!skipValidation && !this._validateStateChange('global.enabled', enabled)) {
                    throw new Error(`Invalid global state value: ${enabled}`);
                }

                const previousState = this._state.isActive;

                // Transaction management
                const transaction = this._beginTransaction('setGrayscaleState', {
                    enabled,
                    source,
                    animated,
                });

                try {
                    // Update state
                    this._state.isActive = enabled;
                    this._state.isEnabled = enabled;
                    this._state.lastToggleTime = Date.now();

                    // Commit transaction
                    this._commitTransaction(transaction);

                    // Persistence
                    if (!skipPersistence) {
                        this._schedulePersistence();
                    }

                    // Event emission
                    if (!skipEvents) {
                        const eventData = new GLib.Variant('a{sv}', {
                            source: new GLib.Variant('s', source),
                            animated: new GLib.Variant('b', animated),
                        });
                        (this as any).emit('state-changed', enabled, previousState, eventData);
                    }

                    // Performance tracking
                    const duration = GLib.get_monotonic_time() / 1000 - startTime;
                    this._recordPerformanceMetric('globalToggle', duration);

                    console.log(
                        `[StateManager] Global state changed: ${enabled} (source: ${source})`
                    );
                    return true;
                } catch (error) {
                    this._rollbackTransaction(transaction);
                    throw error;
                }
            } catch (error) {
                this._recordError('setGrayscaleState', error);
                throw error;
            }
        }

        async toggleGrayscaleState(options: StateOperationOptions = {}): Promise<boolean> {
            const newState = !this._state.isActive;
            await this.setGrayscaleState(newState, { ...options, source: 'toggle' });
            return newState;
        }

        // Monitor State API
        getMonitorState(monitorIndex: number): boolean {
            if (!Number.isInteger(monitorIndex) || monitorIndex < 0) {
                console.warn(`[StateManager] Invalid monitor index: ${monitorIndex}`);
                return false;
            }

            const effect = this._state.effects.get(monitorIndex);
            return effect ? effect.isActive : false;
        }

        async setMonitorState(
            monitorIndex: number,
            enabled: boolean,
            options: StateOperationOptions = {}
        ): Promise<boolean> {
            if (!Number.isInteger(monitorIndex) || monitorIndex < 0) {
                throw new Error(`Invalid monitor index: ${monitorIndex}`);
            }

            if (!this._initialized) {
                throw new Error('StateManager not initialized');
            }

            // Initialize monitor state if needed
            if (!this._state.effects.has(monitorIndex)) {
                await this.initializeMonitorState(monitorIndex);
            }

            const previousState = this._state.effects.get(monitorIndex) || { isActive: false };
            const transaction = this._beginTransaction('setMonitorState', {
                monitorIndex,
                enabled,
                source: options.source || 'api',
            });

            try {
                // Update monitor in effects map
                this._state.effects.set(monitorIndex, {
                    isActive: enabled,
                    config: {} as any, // Will be filled by effect manager
                    monitorIndex,
                });

                this._commitTransaction(transaction);

                if (!options.skipPersistence) {
                    this._schedulePersistence();
                }

                if (!options.skipEvents) {
                    (this as any).emit(
                        'monitor-state-changed',
                        monitorIndex,
                        enabled,
                        previousState
                    );
                }

                console.log(`[StateManager] Monitor ${monitorIndex} state changed: ${enabled}`);
                return true;
            } catch (error) {
                this._rollbackTransaction(transaction);
                throw error;
            }
        }

        getAllMonitorStates(): Record<number, boolean> {
            const states: Record<number, boolean> = {};
            this._state.effects.forEach((effect, index) => {
                states[index] = effect.isActive;
            });
            return states;
        }

        hasMonitorState(monitorIndex: number): boolean {
            return this._state.effects.has(monitorIndex);
        }

        async initializeMonitorState(monitorIndex: number, initialState = false): Promise<any> {
            if (!Number.isInteger(monitorIndex) || monitorIndex < 0) {
                throw new Error(`Invalid monitor index: ${monitorIndex}`);
            }

            // Don't overwrite existing state
            if (this._state.effects.has(monitorIndex)) {
                return this._state.effects.get(monitorIndex);
            }

            const monitorState = {
                isActive: initialState,
                config: {} as any,
                monitorIndex,
            };

            this._state.effects.set(monitorIndex, monitorState);

            // Try to get monitor info from MonitorManager if available
            if (this._monitorManager) {
                const monitorInfo = this._monitorManager.getMonitorInfo(monitorIndex);
                if (monitorInfo) {
                    // Store additional monitor info if needed
                }
            }

            console.log(
                `[StateManager] Initialized monitor ${monitorIndex} state: ${initialState}`
            );
            return monitorState;
        }

        async syncMonitorStates(): Promise<void> {
            if (!this._monitorManager) {
                console.warn(
                    '[StateManager] Cannot sync monitor states: MonitorManager not available'
                );
                return;
            }

            const activeMonitors = this._monitorManager.getActiveMonitors();
            const globalState = this.getGrayscaleState();

            // Initialize state for newly detected monitors
            for (const monitor of activeMonitors) {
                if (!this.hasMonitorState(monitor.index)) {
                    await this.initializeMonitorState(monitor.index, globalState);
                }
            }

            // Mark inactive monitors (but don't delete their state)
            const activeIndices = new Set(activeMonitors.map((m: MonitorInfo) => m.index));
            this._state.effects.forEach((effect, index) => {
                if (!activeIndices.has(index)) {
                    // Monitor no longer active, but preserve state for when it returns
                    console.log(
                        `[StateManager] Monitor ${index} is no longer active, preserving state`
                    );
                }
            });

            console.log(
                `[StateManager] Synced states for ${activeMonitors.length} active monitors`
            );
        }

        getPerMonitorMode(): boolean {
            return this.getSetting('per-monitor-mode') === true;
        }

        // Settings Integration
        async updateSetting(
            key: string,
            value: unknown,
            options: StateOperationOptions = {}
        ): Promise<boolean> {
            if (!this._settingsController) {
                throw new Error('Settings controller not available');
            }

            const transaction = this._beginTransaction('updateSetting', { key, value });

            try {
                // Update local cache
                this._state.currentSettings = {
                    ...this._state.currentSettings,
                    [key]: value,
                } as any;

                // Persist through settings controller
                if (!options.skipPersistence) {
                    await this._settingsController.setSetting(key, value);
                }

                this._commitTransaction(transaction);

                // Emit settings change event
                if (!options.skipEvents) {
                    (this as any).emit(
                        'settings-changed',
                        key,
                        new GLib.Variant('s', JSON.stringify(value))
                    );
                }

                return true;
            } catch (error) {
                this._rollbackTransaction(transaction);
                throw error;
            }
        }

        getSetting(key: string): unknown {
            return (this._state.currentSettings as any)[key];
        }

        // State Persistence
        async saveState(): Promise<boolean> {
            if (!this._settingsController) {
                return false;
            }

            try {
                // Save global state
                await this._settingsController.setSetting('global-enabled', this._state.isActive);

                // Save monitor states if in per-monitor mode
                if (this.getPerMonitorMode()) {
                    const monitorStates: Record<string, boolean> = {};
                    this._state.effects.forEach((effect, index) => {
                        monitorStates[index.toString()] = effect.isActive;
                    });
                    await this._settingsController.setSetting('monitor-states', monitorStates);
                }

                console.log('[StateManager] State saved successfully');
                return true;
            } catch (error) {
                console.error('[StateManager] State save failed:', error);
                return false;
            }
        }

        async loadState(): Promise<boolean> {
            if (!this._settingsController) {
                return false;
            }

            try {
                // Load global state
                const globalEnabled = this._settingsController.getSetting('global-enabled');
                if (typeof globalEnabled === 'boolean') {
                    this._state.isActive = globalEnabled;
                    this._state.isEnabled = globalEnabled;
                }

                // Load monitor states
                const monitorStates = this._settingsController.getSetting('monitor-states') || {};
                for (const index of Object.keys(monitorStates)) {
                    const monitorIndex = parseInt(index);
                    await this.initializeMonitorState(monitorIndex, monitorStates[index]);
                }

                // Load all settings into cache
                await this._loadSettingsCache();

                console.log('[StateManager] State loaded successfully');
                return true;
            } catch (error) {
                console.error('[StateManager] State load failed:', error);
                return false;
            }
        }

        private async _loadSettingsCache(): Promise<void> {
            // Load key settings into state cache
            const importantSettings = [
                'per-monitor-mode',
                'show-panel-indicator',
                'show-notifications',
                'animation-duration',
                'effect-quality',
            ];

            for (const key of importantSettings) {
                try {
                    const value = this._settingsController.getSetting(key);
                    if (value !== undefined && value !== null) {
                        (this._state.currentSettings as any)[key] = value;
                    }
                } catch (error) {
                    console.warn(`[StateManager] Failed to load setting ${key}:`, error);
                }
            }
        }

        // Private Implementation
        private _createInitialState(): ExtensionState {
            return {
                isActive: false,
                isEnabled: false,
                currentSettings: {
                    enabled: false,
                    brightness: 1.0,
                    contrast: 1.0,
                    keybinding: ['<Super>g'],
                    showIndicator: true,
                    quickSettingsEnabled: true,
                    autoDetectMonitors: true,
                    perMonitorSettings: false,
                },
                monitors: [],
                effects: new Map(),
                lastToggleTime: 0,
            };
        }

        private _setupValidators(): void {
            this._stateValidators.set(
                'global.enabled',
                (value): value is boolean => typeof value === 'boolean'
            );
            this._stateValidators.set(
                'monitor.enabled',
                (value): value is boolean => typeof value === 'boolean'
            );
            this._stateValidators.set(
                'settings.animationDuration',
                (value): value is number =>
                    typeof value === 'number' && value >= 0.0 && value <= 2.0
            );
            this._stateValidators.set(
                'settings.per-monitor-mode',
                (value): value is boolean => typeof value === 'boolean'
            );
            this._stateValidators.set(
                'settings.keyboardShortcut',
                (value): value is string[] =>
                    Array.isArray(value) && value.every(s => typeof s === 'string')
            );
            this._stateValidators.set('settings.effectQuality', (value): value is string =>
                ['low', 'medium', 'high'].includes(value as string)
            );
        }

        private _validateStateChange(path: string, value: unknown): boolean {
            const validator = this._stateValidators.get(path);
            return validator ? validator(value) : true;
        }

        // Transaction Management
        private _beginTransaction(operation: string, data: Record<string, any> = {}): Transaction {
            const transaction: Transaction = {
                id: GLib.uuid_string_random(),
                operation,
                data,
                timestamp: Date.now(),
                state: JSON.parse(JSON.stringify(this._state)), // Deep clone
            };

            this._transactionLog.push(transaction);

            // Limit transaction log size
            if (this._transactionLog.length > 50) {
                this._transactionLog = this._transactionLog.slice(-30);
            }

            return transaction;
        }

        private _commitTransaction(transaction: Transaction): void {
            const index = this._transactionLog.findIndex(t => t.id === transaction.id);
            if (index !== -1) {
                this._transactionLog.splice(index, 1);
            }
        }

        private _rollbackTransaction(transaction: Transaction): void {
            console.warn(
                `[StateManager] Rolling back transaction: ${transaction.operation}`,
                transaction.data
            );

            this._state = transaction.state;
            const index = this._transactionLog.findIndex(t => t.id === transaction.id);
            if (index !== -1) {
                this._transactionLog.splice(index, 1);
            }
        }

        private _schedulePersistence(): void {
            if (this._persistenceTimer) {
                GLib.source_remove(this._persistenceTimer);
                this._persistenceTimer = null;
            }

            this._persistenceTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                this.saveState()
                    .then(() => {
                        this._persistenceTimer = null;
                    })
                    .catch((error: Error) => {
                        console.error('[StateManager] Failed to persist state:', error);
                        this._persistenceTimer = null;
                    });
                return GLib.SOURCE_REMOVE;
            });
        }

        // Performance Monitoring
        private _recordPerformanceMetric(operation: string, duration: number): void {
            if (operation === 'globalToggle') {
                this._performanceMetrics.toggleTimes.push(duration);

                // Keep only last 100 measurements
                if (this._performanceMetrics.toggleTimes.length > 100) {
                    this._performanceMetrics.toggleTimes =
                        this._performanceMetrics.toggleTimes.slice(-100);
                }
            }
        }

        private _recordError(operation: string, error: any): void {
            const errorKey = `${operation}-${error.category || 'unknown'}`;
            const count = this._performanceMetrics.errorCounts.get(errorKey) || 0;
            this._performanceMetrics.errorCounts.set(errorKey, count + 1);
        }

        private _handleSettingChange(key: string, variant: GLib.Variant): void {
            // Unpack the variant based on type
            let value: unknown;
            const typeString = variant.get_type_string();

            switch (typeString) {
                case 'b':
                    value = variant.get_boolean();
                    break;
                case 'd':
                    value = variant.get_double();
                    break;
                case 's':
                    value = variant.get_string()[0];
                    break;
                case 'as':
                    value = variant.get_strv();
                    break;
                default:
                    value = variant.unpack();
            }

            (this._state.currentSettings as any)[key] = value;
            (this as any).emit('settings-changed', key, variant);

            console.log(`[StateManager] Setting changed: ${key} = ${JSON.stringify(value)}`);
        }

        // Public utility methods
        getState(): ExtensionState {
            return JSON.parse(JSON.stringify(this._state)); // Return deep copy
        }

        getPerformanceMetrics(): Record<string, any> {
            return {
                sessionUptime: Date.now() - (this._state.lastToggleTime || Date.now()),
                transactionLogSize: this._transactionLog.length,
                averageToggleTime:
                    this._performanceMetrics.toggleTimes.length > 0
                        ? this._performanceMetrics.toggleTimes.reduce((a, b) => a + b, 0) /
                          this._performanceMetrics.toggleTimes.length
                        : 0,
            };
        }

        // Debugging
        dumpState(): void {
            console.log(
                '[StateManager] Current state:',
                JSON.stringify(
                    this._state,
                    (key, value) => {
                        // Handle Map serialization
                        if (value instanceof Map) {
                            return Object.fromEntries(value);
                        }
                        return value;
                    },
                    2
                )
            );
        }
    }
);

export type StateManagerType = InstanceType<typeof StateManager>;
