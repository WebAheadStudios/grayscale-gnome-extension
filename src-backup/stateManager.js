// State Manager for GNOME Shell Grayscale Toggle Extension
// Central state coordination, settings persistence, and event publishing

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

export class StateManager extends GObject.Object {
    static [GObject.signals] = {
        'state-changed': {
            param_types: [GObject.TYPE_BOOLEAN, GObject.TYPE_BOOLEAN, GObject.TYPE_VARIANT],
        },
        'monitor-state-changed': {
            param_types: [GObject.TYPE_INT, GObject.TYPE_BOOLEAN, GObject.TYPE_BOOLEAN],
        },
        'settings-changed': {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_VARIANT],
        },
    };

    constructor(extension) {
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
    async initialize() {
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
                console.warn('[StateManager] MonitorManager not available, using basic monitor support');
            }

            // Load initial state from settings
            await this.loadState();

            // Connect to settings changes
            this._settingsController.connect('setting-changed',
                (controller, key, variant) => this._handleSettingChange(key, variant),
            );

            this._initialized = true;
            console.log('[StateManager] Initialized successfully');
            return true;

        } catch (error) {
            console.error('[StateManager] Initialization failed:', error);
            throw error;
        }
    }

    destroy() {
        if (!this._initialized) {
            return;
        }

        // Save current state before destruction
        this.saveState().catch(error => {
            console.warn('[StateManager] Failed to save state during destruction:', error);
        });

        // Cancel timers
        if (this._persistenceTimer) {
            clearTimeout(this._persistenceTimer);
            this._persistenceTimer = null;
        }

        // Clear data
        this._state = null;
        this._settingsController = null;
        this._monitorManager = null;
        this._stateValidators.clear();
        this._transactionLog = [];
        this._performanceMetrics = null;
        this._initialized = false;

        console.log('[StateManager] Destroyed successfully');
    }

    // Global State API
    getGrayscaleState() {
        return this._state?.global.enabled || false;
    }

    async setGrayscaleState(enabled, options = {}) {
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
        const startTime = performance.now();

        try {
            // Validation
            if (!skipValidation && !this._validateStateChange('global.enabled', enabled)) {
                throw new Error(`Invalid global state value: ${enabled}`);
            }

            const previousState = this._state.global.enabled;

            // Transaction management
            const transaction = this._beginTransaction('setGrayscaleState', {
                enabled, source, animated,
            });

            try {
                // Update state
                this._state.global.enabled = enabled;
                this._state.global.previousState = previousState;
                this._state.global.lastToggleTime = Date.now();
                this._state.global.toggleCount += 1;

                // Commit transaction
                this._commitTransaction(transaction);

                // Persistence
                if (!skipPersistence) {
                    this._schedulePersistence();
                }

                // Event emission
                if (!skipEvents) {
                    this.emit('state-changed', enabled, previousState,
                        new GLib.Variant('a{sv}', { source: new GLib.Variant('s', source), animated: new GLib.Variant('b', animated) }));
                }

                // Performance tracking
                const duration = performance.now() - startTime;
                this._recordPerformanceMetric('globalToggle', duration);

                console.log(`[StateManager] Global state changed: ${enabled} (source: ${source})`);
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

    async toggleGrayscaleState(options = {}) {
        const newState = !this._state.global.enabled;
        await this.setGrayscaleState(newState, { ...options, source: 'toggle' });
        return newState;
    }

    // Monitor State API
    getMonitorState(monitorIndex) {
        if (!Number.isInteger(monitorIndex) || monitorIndex < 0) {
            console.warn(`[StateManager] Invalid monitor index: ${monitorIndex}`);
            return false;
        }

        const monitor = this._state.monitors[monitorIndex];
        return monitor ? monitor.enabled : false;
    }

    async setMonitorState(monitorIndex, enabled, options = {}) {
        if (!Number.isInteger(monitorIndex) || monitorIndex < 0) {
            throw new Error(`Invalid monitor index: ${monitorIndex}`);
        }

        if (!this._initialized) {
            throw new Error('StateManager not initialized');
        }

        // Initialize monitor state if needed
        if (!this._state.monitors[monitorIndex]) {
            await this.initializeMonitorState(monitorIndex);
        }

        const previousState = this._state.monitors[monitorIndex].enabled;
        const transaction = this._beginTransaction('setMonitorState', {
            monitorIndex, enabled, source: options.source || 'api',
        });

        try {
            this._state.monitors[monitorIndex].enabled = enabled;
            this._state.monitors[monitorIndex].lastToggleTime = Date.now();

            this._commitTransaction(transaction);

            if (!options.skipPersistence) {
                this._schedulePersistence();
            }

            if (!options.skipEvents) {
                this.emit('monitor-state-changed', monitorIndex, enabled, previousState);
            }

            console.log(`[StateManager] Monitor ${monitorIndex} state changed: ${enabled}`);
            return true;

        } catch (error) {
            this._rollbackTransaction(transaction);
            throw error;
        }
    }

    getAllMonitorStates() {
        const states = {};
        Object.keys(this._state.monitors).forEach(index => {
            states[index] = this._state.monitors[index].enabled;
        });
        return states;
    }

    hasMonitorState(monitorIndex) {
        return this._state.monitors.hasOwnProperty(monitorIndex);
    }

    async initializeMonitorState(monitorIndex, initialState = false) {
        if (!Number.isInteger(monitorIndex) || monitorIndex < 0) {
            throw new Error(`Invalid monitor index: ${monitorIndex}`);
        }

        // Don't overwrite existing state
        if (this._state.monitors[monitorIndex]) {
            return this._state.monitors[monitorIndex];
        }

        this._state.monitors[monitorIndex] = {
            enabled: initialState,
            effectActive: false,
            lastToggleTime: Date.now(),
            geometry: null,
            connector: null,
            isPrimary: false,
        };

        // Try to get monitor info from MonitorManager if available
        if (this._monitorManager) {
            const monitorInfo = this._monitorManager.getMonitorInfo(monitorIndex);
            if (monitorInfo) {
                this._state.monitors[monitorIndex].geometry = monitorInfo.geometry;
                this._state.monitors[monitorIndex].connector = monitorInfo.connector;
                this._state.monitors[monitorIndex].isPrimary = monitorInfo.isPrimary;
            }
        }

        console.log(`[StateManager] Initialized monitor ${monitorIndex} state: ${initialState}`);
        return this._state.monitors[monitorIndex];
    }

    async syncMonitorStates() {
        if (!this._monitorManager) {
            console.warn('[StateManager] Cannot sync monitor states: MonitorManager not available');
            return;
        }

        const activeMonitors = this._monitorManager.getActiveMonitors();
        const globalState = this.getGrayscaleState();

        // Initialize state for newly detected monitors
        for (const monitor of activeMonitors) {
            if (!this.hasMonitorState(monitor.index)) {
                await this.initializeMonitorState(monitor.index, globalState);
            } else {
                // Update monitor details
                const monitorState = this._state.monitors[monitor.index];
                monitorState.geometry = monitor.geometry;
                monitorState.connector = monitor.connector;
                monitorState.isPrimary = monitor.isPrimary;
            }
        }

        // Mark inactive monitors (but don't delete their state)
        const activeIndices = new Set(activeMonitors.map(m => m.index));
        Object.keys(this._state.monitors).forEach(indexStr => {
            const index = parseInt(indexStr);
            if (!activeIndices.has(index)) {
                // Monitor no longer active, but preserve state for when it returns
                console.log(`[StateManager] Monitor ${index} is no longer active, preserving state`);
            }
        });

        console.log(`[StateManager] Synced states for ${activeMonitors.length} active monitors`);
    }

    getPerMonitorMode() {
        return this.getSetting('per-monitor-mode') === true;
    }

    async migrateMonitorStates(oldLayout, newLayout) {
        // Handle monitor layout changes by maintaining state continuity
        // This is a complex operation that tries to match monitors across layout changes

        if (!oldLayout || !newLayout) {
            console.warn('[StateManager] Cannot migrate monitor states: invalid layouts');
            return;
        }

        const migration = {
            preserved: [],
            moved: [],
            added: [],
            removed: [],
        };

        // Try to match monitors by connector first, then by properties
        for (const newMonitor of newLayout) {
            const matchingOld = oldLayout.find(old =>
                old.connector === newMonitor.connector ||
                (old.geometry.width === newMonitor.geometry.width &&
                 old.geometry.height === newMonitor.geometry.height &&
                 old.isPrimary === newMonitor.isPrimary),
            );

            if (matchingOld) {
                if (matchingOld.index !== newMonitor.index) {
                    // Monitor moved to different index
                    migration.moved.push({
                        from: matchingOld.index,
                        to: newMonitor.index,
                        monitor: newMonitor,
                    });
                } else {
                    // Monitor stayed in same position
                    migration.preserved.push(newMonitor);
                }
            } else {
                // New monitor
                migration.added.push(newMonitor);
            }
        }

        // Identify removed monitors
        for (const oldMonitor of oldLayout) {
            const stillExists = newLayout.find(newMon =>
                newMon.connector === oldMonitor.connector,
            );
            if (!stillExists) {
                migration.removed.push(oldMonitor);
            }
        }

        // Apply migration
        const statesToMove = {};
        for (const { from, to } of migration.moved) {
            if (this._state.monitors[from]) {
                statesToMove[to] = { ...this._state.monitors[from] };
                delete this._state.monitors[from];
            }
        }

        // Apply moved states
        Object.entries(statesToMove).forEach(([index, state]) => {
            this._state.monitors[index] = state;
        });

        // Initialize new monitors
        const globalState = this.getGrayscaleState();
        for (const monitor of migration.added) {
            await this.initializeMonitorState(monitor.index, globalState);
        }

        console.log('[StateManager] Monitor state migration completed', migration);
        return migration;
    }

    // Settings Integration
    async updateSetting(key, value, options = {}) {
        if (!this._settingsController) {
            throw new Error('Settings controller not available');
        }

        const previousValue = this._state.settings[key];

        // Validation
        if (!this._validateSetting(key, value)) {
            throw new Error(`Invalid setting value for ${key}: ${value}`);
        }

        const transaction = this._beginTransaction('updateSetting', { key, value });

        try {
            // Update local cache
            this._state.settings[key] = value;

            // Persist through settings controller
            if (!options.skipPersistence) {
                await this._settingsController.setSetting(key, value);
            }

            this._commitTransaction(transaction);

            // Emit settings change event
            if (!options.skipEvents) {
                this.emit('settings-changed', key, new GLib.Variant('s', JSON.stringify(value)));
            }

            return true;

        } catch (error) {
            this._rollbackTransaction(transaction);
            throw error;
        }
    }

    getSetting(key) {
        return this._state.settings[key];
    }

    // State Persistence
    async saveState() {
        if (!this._settingsController) {
            return false;
        }

        try {
            // Save global state
            await this._settingsController.setSetting('global-enabled',
                this._state.global.enabled);

            // Save monitor states if in per-monitor mode
            if (this._state.settings.perMonitorMode) {
                const monitorStates = {};
                Object.keys(this._state.monitors).forEach(index => {
                    monitorStates[index] = this._state.monitors[index].enabled;
                });
                await this._settingsController.setSetting('monitor-states', monitorStates);
            }

            // Save performance metrics
            await this._settingsController.setSetting('performance-metrics', {
                averageToggleTime: this._state.performance.averageToggleTime,
                totalToggles: this._state.global.toggleCount,
            });

            console.log('[StateManager] State saved successfully');
            return true;

        } catch (error) {
            console.error('[StateManager] State save failed:', error);
            return false;
        }
    }

    async loadState() {
        if (!this._settingsController) {
            return false;
        }

        try {
            // Load global state
            const globalEnabled = this._settingsController.getSetting('global-enabled');
            if (typeof globalEnabled === 'boolean') {
                this._state.global.enabled = globalEnabled;
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

    async _loadSettingsCache() {
        const settingKeys = Object.keys(this._state.settings);

        for (const key of settingKeys) {
            try {
                const value = this._settingsController.getSetting(key);
                if (value !== undefined && value !== null) {
                    this._state.settings[key] = value;
                }
            } catch (error) {
                console.warn(`[StateManager] Failed to load setting ${key}:`, error);
            }
        }
    }

    // Private Implementation
    _createInitialState() {
        return {
            global: {
                enabled: false,
                previousState: false,
                lastToggleTime: 0,
                toggleCount: 0,
                sessionStartTime: Date.now(),
            },
            monitors: {},
            settings: {
                autoEnable: false,
                animationDuration: 0.3,
                keyboardShortcut: ['<Super>g'],
                perMonitorMode: false,
                showPanelIndicator: true,
                showNotifications: true,
                effectQuality: 'high',
                performanceMode: false,
            },
            performance: {
                lastEffectTime: 0,
                memoryUsage: 0,
                errorCount: 0,
                averageToggleTime: 0,
            },
        };
    }

    _setupValidators() {
        this._stateValidators.set('global.enabled', (value) => typeof value === 'boolean');
        this._stateValidators.set('monitor.enabled', (value) => typeof value === 'boolean');
        this._stateValidators.set('settings.animationDuration',
            (value) => typeof value === 'number' && value >= 0.0 && value <= 2.0,
        );
        this._stateValidators.set('settings.per-monitor-mode', (value) => typeof value === 'boolean');
        this._stateValidators.set('settings.keyboardShortcut',
            (value) => Array.isArray(value) && value.every(s => typeof s === 'string'),
        );
        this._stateValidators.set('settings.effectQuality',
            (value) => ['low', 'medium', 'high'].includes(value),
        );
        this._stateValidators.set('settings.monitor-exclusions',
            (value) => Array.isArray(value) && value.every(i => Number.isInteger(i) && i >= 0),
        );
    }

    _validateStateChange(path, value) {
        const validator = this._stateValidators.get(path);
        return validator ? validator(value) : true;
    }

    _validateSetting(key, value) {
        const validatorKey = `settings.${key}`;
        const validator = this._stateValidators.get(validatorKey);
        return validator ? validator(value) : true;
    }

    // Transaction Management
    _beginTransaction(operation, data = {}) {
        const transaction = {
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

    _commitTransaction(transaction) {
        const index = this._transactionLog.findIndex(t => t.id === transaction.id);
        if (index !== -1) {
            this._transactionLog.splice(index, 1);
        }
    }

    _rollbackTransaction(transaction) {
        console.warn(`[StateManager] Rolling back transaction: ${transaction.operation}`,
            transaction.data);

        this._state = transaction.state;
        const index = this._transactionLog.findIndex(t => t.id === transaction.id);
        if (index !== -1) {
            this._transactionLog.splice(index, 1);
        }
    }

    _schedulePersistence() {
        if (this._persistenceTimer) {
            clearTimeout(this._persistenceTimer);
        }

        this._persistenceTimer = setTimeout(async () => {
            await this.saveState();
            this._persistenceTimer = null;
        }, 1000); // 1 second debounce
    }

    // Performance Monitoring
    _recordPerformanceMetric(operation, duration) {
        if (operation === 'globalToggle') {
            this._performanceMetrics.toggleTimes.push(duration);

            // Keep only last 100 measurements
            if (this._performanceMetrics.toggleTimes.length > 100) {
                this._performanceMetrics.toggleTimes =
                    this._performanceMetrics.toggleTimes.slice(-100);
            }

            // Update average
            const sum = this._performanceMetrics.toggleTimes.reduce((a, b) => a + b, 0);
            this._state.performance.averageToggleTime =
                sum / this._performanceMetrics.toggleTimes.length;
        }
    }

    _recordError(operation, error) {
        const errorKey = `${operation}-${error.category || 'unknown'}`;
        const count = this._performanceMetrics.errorCounts.get(errorKey) || 0;
        this._performanceMetrics.errorCounts.set(errorKey, count + 1);

        this._state.performance.errorCount += 1;
    }

    _handleSettingChange(key, variant) {
        if (key in this._state.settings) {
            // Unpack the variant based on type
            let value;
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

            this._state.settings[key] = value;
            this.emit('settings-changed', key, variant);

            console.log(`[StateManager] Setting changed: ${key} = ${JSON.stringify(value)}`);
        }
    }

    // Public utility methods
    getState() {
        return JSON.parse(JSON.stringify(this._state)); // Return deep copy
    }

    getPerformanceMetrics() {
        return {
            ...this._state.performance,
            sessionUptime: Date.now() - this._state.global.sessionStartTime,
            transactionLogSize: this._transactionLog.length,
        };
    }

    // Debugging
    dumpState() {
        console.log('[StateManager] Current state:', JSON.stringify(this._state, null, 2));
    }
}
