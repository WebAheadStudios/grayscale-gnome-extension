// Monitor Manager for GNOME Shell Grayscale Toggle Extension
// Multi-monitor detection, hotplug event handling, and display management

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class MonitorManager extends GObject.Object {
    static [GObject.signals] = {
        'monitor-added': {
            param_types: [GObject.TYPE_VARIANT],
        },
        'monitor-removed': {
            param_types: [GObject.TYPE_INT],
        },
        'monitor-changed': {
            param_types: [GObject.TYPE_INT, GObject.TYPE_VARIANT],
        },
        'monitors-reconfigured': {
            param_types: [GObject.TYPE_VARIANT],
        },
    };

    constructor(extension) {
        super();

        this._extension = extension;
        this._monitors = new Map(); // monitorIndex -> MonitorInfo
        this._layoutManager = null;
        this._hotplugManager = null;
        this._detectionEngine = new AdvancedMonitorDetection();

        // Signal connections
        this._signalConnections = [];

        // Performance tracking
        this._lastScanTime = 0;
        this._scanCount = 0;

        this._initialized = false;
    }

    // Initialization and lifecycle
    async initialize() {
        if (this._initialized) {
            return true;
        }

        try {
            console.log('[MonitorManager] Initializing...');

            this._layoutManager = Main.layoutManager;
            this._hotplugManager = new HotplugEventManager(this,
                this._extension.getComponent('EffectManager'));

            await this._performInitialScan();
            await this._hotplugManager.initialize();

            this._initialized = true;
            console.log('[MonitorManager] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[MonitorManager] Initialization failed:', error);
            return false;
        }
    }

    destroy() {
        console.log('[MonitorManager] Destroying...');

        if (this._hotplugManager) {
            this._hotplugManager.destroy();
            this._hotplugManager = null;
        }

        this._disconnectSignals();
        this._monitors.clear();
        this._initialized = false;

        console.log('[MonitorManager] Destroyed');
    }

    // Monitor discovery and management
    async _performInitialScan() {
        console.log('[MonitorManager] Performing initial monitor scan...');

        const { monitors, changes } = await this._detectionEngine.detectMonitors();
        this._updateMonitorRegistry(monitors);
        this._processInitialState(monitors);

        this._lastScanTime = Date.now();
        this._scanCount++;

        console.log(`[MonitorManager] Initial scan complete: ${monitors.length} monitors detected`);
    }

    async rescanMonitors() {
        console.log('[MonitorManager] Rescanning monitors...');

        const { monitors, changes } = await this._detectionEngine.detectMonitors();
        this._updateMonitorRegistry(monitors);

        this._lastScanTime = Date.now();
        this._scanCount++;

        return { monitors: Array.from(this._monitors.values()), changes };
    }

    _updateMonitorRegistry(monitors) {
        // Clear existing monitors
        this._monitors.clear();

        // Add detected monitors
        monitors.forEach(monitor => {
            this._monitors.set(monitor.index, {
                ...monitor,
                lastSeen: Date.now(),
                active: true,
            });
        });
    }

    _processInitialState(monitors) {
        const stateManager = this._extension.getComponent('StateManager');
        if (!stateManager) {return;}

        // Initialize state for newly detected monitors
        monitors.forEach(monitor => {
            const hasStoredState = stateManager.hasMonitorState(monitor.index);
            if (!hasStoredState) {
                // Initialize with global state if no per-monitor state exists
                const globalState = stateManager.getGrayscaleState();
                stateManager.initializeMonitorState(monitor.index, globalState);
            }
        });
    }

    // Public API - Monitor access
    getActiveMonitors() {
        return Array.from(this._monitors.values()).filter(monitor => monitor.active);
    }

    getMonitorCount() {
        return this._monitors.size;
    }

    getMonitorInfo(index) {
        return this._monitors.get(index) || null;
    }

    getAllMonitors() {
        return Array.from(this._monitors.values());
    }

    getMonitorActor(index) {
        const monitor = this._monitors.get(index);
        if (!monitor || !monitor.actor) {
            // Fallback to layout manager
            if (this._layoutManager && this._layoutManager.monitors[index]) {
                return this._layoutManager.monitors[index];
            }
            return null;
        }
        return monitor.actor;
    }

    getGlobalStage() {
        return global.stage;
    }

    getPrimaryMonitor() {
        return Array.from(this._monitors.values()).find(monitor => monitor.isPrimary) || null;
    }

    // Monitor properties
    hasMultipleMonitors() {
        return this._monitors.size > 1;
    }

    isValidMonitorIndex(index) {
        return this._monitors.has(index);
    }

    // Signal management
    _disconnectSignals() {
        this._signalConnections.forEach(({ object, signalId }) => {
            if (object && signalId) {
                object.disconnect(signalId);
            }
        });
        this._signalConnections = [];
    }

    // Events for external components
    onMonitorAdded(callback) {
        return this.connect('monitor-added', callback);
    }

    onMonitorRemoved(callback) {
        return this.connect('monitor-removed', callback);
    }

    onMonitorChanged(callback) {
        return this.connect('monitor-changed', callback);
    }

    onMonitorsReconfigured(callback) {
        return this.connect('monitors-reconfigured', callback);
    }
}

// Advanced monitor detection engine
class AdvancedMonitorDetection {
    constructor() {
        this._detectionMethods = [
            this._detectViaLayoutManager.bind(this),
            this._detectViaMetaDisplay.bind(this),
            this._detectViaConnectors.bind(this),
        ];
        this._lastDetectedMonitors = new Map();
    }

    async detectMonitors() {
        const detectionResults = [];

        // Try each detection method
        for (const method of this._detectionMethods) {
            try {
                const result = await method();
                if (result && result.length > 0) {
                    detectionResults.push(result);
                }
            } catch (error) {
                console.warn('[AdvancedMonitorDetection] Detection method failed:', error);
            }
        }

        // Merge and validate results
        const consolidatedMonitors = this._consolidateDetectionResults(detectionResults);

        // Detect changes from last scan
        const changes = this._detectChanges(consolidatedMonitors);

        // Update cache
        this._lastDetectedMonitors = new Map(
            consolidatedMonitors.map(monitor => [monitor.index, monitor]),
        );

        return { monitors: consolidatedMonitors, changes };
    }

    _detectViaLayoutManager() {
        const layoutManager = Main.layoutManager;
        const monitors = [];

        for (let i = 0; i < layoutManager.monitors.length; i++) {
            const monitor = layoutManager.monitors[i];

            monitors.push({
                index: i,
                geometry: {
                    x: monitor.x,
                    y: monitor.y,
                    width: monitor.width,
                    height: monitor.height,
                },
                isPrimary: i === layoutManager.primaryIndex,
                scaleFactor: monitor.geometry_scale || 1.0,
                connector: this._getConnectorName(i),
                actor: monitor,
                detectionMethod: 'layout-manager',
                confidence: 0.95,
            });
        }

        return monitors;
    }

    _detectViaMetaDisplay() {
        const display = global.display;
        const monitors = [];

        for (let i = 0; i < display.get_n_monitors(); i++) {
            const geometry = display.get_monitor_geometry(i);
            const scale = display.get_monitor_scale(i);

            monitors.push({
                index: i,
                geometry: {
                    x: geometry.x,
                    y: geometry.y,
                    width: geometry.width,
                    height: geometry.height,
                },
                isPrimary: i === display.get_primary_monitor(),
                scaleFactor: scale,
                connector: `META-${i}`,
                actor: null,
                detectionMethod: 'meta-display',
                confidence: 0.90,
            });
        }

        return monitors;
    }

    _detectViaConnectors() {
        // Fallback method - minimal implementation
        try {
            const backend = Meta.get_backend();
            const monitorManager = backend.get_monitor_manager();
            // This method provides additional validation but may not be available
            // on all systems, so it's used as a fallback/verification method
            return [];
        } catch {
            return [];
        }
    }

    _consolidateDetectionResults(results) {
        if (results.length === 0) {return [];}

        // Use the highest confidence result set
        const bestResult = results.reduce((best, current) => {
            const bestConfidence = this._calculateAverageConfidence(best);
            const currentConfidence = this._calculateAverageConfidence(current);
            return currentConfidence > bestConfidence ? current : best;
        });

        return bestResult.map(monitor => ({
            ...monitor,
            lastSeen: Date.now(),
            active: true,
        }));
    }

    _calculateAverageConfidence(monitors) {
        if (!monitors || monitors.length === 0) {return 0;}
        const totalConfidence = monitors.reduce((sum, monitor) =>
            sum + (monitor.confidence || 0.5), 0);
        return totalConfidence / monitors.length;
    }

    _detectChanges(newMonitors) {
        const changes = {
            added: [],
            removed: [],
            modified: [],
        };

        // Detect added monitors
        newMonitors.forEach(monitor => {
            if (!this._lastDetectedMonitors.has(monitor.index)) {
                changes.added.push(monitor);
            } else {
                // Check for modifications
                const lastMonitor = this._lastDetectedMonitors.get(monitor.index);
                if (this._hasMonitorChanged(lastMonitor, monitor)) {
                    changes.modified.push({ previous: lastMonitor, current: monitor });
                }
            }
        });

        // Detect removed monitors
        this._lastDetectedMonitors.forEach((monitor, index) => {
            if (!newMonitors.find(m => m.index === index)) {
                changes.removed.push(monitor);
            }
        });

        return changes;
    }

    _hasMonitorChanged(previous, current) {
        return (
            previous.geometry.x !== current.geometry.x ||
            previous.geometry.y !== current.geometry.y ||
            previous.geometry.width !== current.geometry.width ||
            previous.geometry.height !== current.geometry.height ||
            previous.scaleFactor !== current.scaleFactor ||
            previous.isPrimary !== current.isPrimary
        );
    }

    _getConnectorName(index) {
        // Attempt to get real connector name
        try {
            const backend = Meta.get_backend();
            const monitorManager = backend.get_monitor_manager();
            const monitors = monitorManager.get_monitors();
            return monitors[index]?.get_connector() || `Monitor-${index}`;
        } catch {
            return `Monitor-${index}`;
        }
    }
}

// Comprehensive hotplug event management
class HotplugEventManager {
    constructor(monitorManager, effectManager) {
        this._monitorManager = monitorManager;
        this._effectManager = effectManager;
        this._pendingOperations = new Map();
        this._debounceTimer = null;
        this._eventQueue = [];
        this._signalConnections = [];
    }

    async initialize() {
        console.log('[HotplugEventManager] Initializing...');

        // Connect to layout manager signals
        const layoutChangeSignal = Main.layoutManager.connect(
            'monitors-changed',
            () => this._handleMonitorsChanged(),
        );
        this._signalConnections.push({
            object: Main.layoutManager,
            signalId: layoutChangeSignal,
        });

        // Connect to display configuration changes
        if (global.display) {
            const displayConfigSignal = global.display.connect(
                'monitors-changed',
                () => this._handleDisplayConfigChanged(),
            );
            this._signalConnections.push({
                object: global.display,
                signalId: displayConfigSignal,
            });
        }

        console.log('[HotplugEventManager] Initialized');
    }

    destroy() {
        console.log('[HotplugEventManager] Destroying...');

        this._signalConnections.forEach(({ object, signalId }) => {
            if (object && signalId) {
                object.disconnect(signalId);
            }
        });
        this._signalConnections = [];

        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._pendingOperations.clear();
        console.log('[HotplugEventManager] Destroyed');
    }

    _handleMonitorsChanged() {
        console.log('[HotplugEventManager] Layout monitors changed');
        this._queueEvent('layout-changed', { source: 'layout-manager', timestamp: Date.now() });
        this._debounceProcessing();
    }

    _handleDisplayConfigChanged() {
        console.log('[HotplugEventManager] Display configuration changed');
        this._queueEvent('display-config-changed', { source: 'meta-display', timestamp: Date.now() });
        this._debounceProcessing();
    }

    _queueEvent(type, data) {
        this._eventQueue.push({ type, data, timestamp: Date.now() });

        // Limit queue size
        if (this._eventQueue.length > 10) {
            this._eventQueue = this._eventQueue.slice(-10);
        }
    }

    _debounceProcessing() {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this._processHotplugEvents();
            this._debounceTimer = null;
        }, 500); // 500ms debounce
    }

    async _processHotplugEvents() {
        if (this._eventQueue.length === 0) {return;}

        console.log(`[HotplugEventManager] Processing ${this._eventQueue.length} events`);

        try {
            // Suspend effects during reconfiguration
            if (this._effectManager && this._effectManager.suspendEffects) {
                await this._effectManager.suspendEffects();
            }

            // Rescan monitors
            const { monitors, changes } = await this._monitorManager.rescanMonitors();

            // Process changes
            await this._processMonitorChanges(changes);

            // Resume effects
            if (this._effectManager && this._effectManager.resumeEffects) {
                await this._effectManager.resumeEffects();
            }

            // Clear processed events
            this._eventQueue = [];

            console.log('[HotplugEventManager] Hotplug processing completed');

        } catch (error) {
            console.error('[HotplugEventManager] Error processing hotplug events:', error);

            // Recovery: try to restore minimal functionality
            await this._attemptRecovery();
        }
    }

    async _processMonitorChanges(changes) {
        const { added, removed, modified } = changes;

        // Handle removed monitors first
        for (const removedMonitor of removed) {
            await this._handleMonitorRemoved(removedMonitor);
        }

        // Handle modified monitors
        for (const { previous, current } of modified) {
            await this._handleMonitorModified(previous, current);
        }

        // Handle added monitors
        for (const addedMonitor of added) {
            await this._handleMonitorAdded(addedMonitor);
        }
    }

    async _handleMonitorRemoved(monitor) {
        console.log(`[HotplugEventManager] Monitor ${monitor.index} removed`);

        // Clean up any effects for this monitor
        const operation = this._pendingOperations.get(`remove-${monitor.index}`);
        if (operation) {
            clearTimeout(operation.timeout);
        }

        // Remove effects immediately
        if (this._effectManager && this._effectManager.removeMonitorEffect) {
            await this._effectManager.removeMonitorEffect(monitor.index);
        }

        // Emit removal signal
        this._monitorManager.emit('monitor-removed', monitor.index);
    }

    async _handleMonitorAdded(monitor) {
        console.log(`[HotplugEventManager] Monitor ${monitor.index} added`);

        // Initialize monitor state
        const stateManager = this._monitorManager._extension.getComponent('StateManager');
        if (stateManager) {
            const globalState = stateManager.getGrayscaleState();

            // Apply current global state to new monitor
            if (globalState) {
                if (this._effectManager && this._effectManager.applyMonitorEffect) {
                    await this._effectManager.applyMonitorEffect(monitor.index, true);
                }
                stateManager.setMonitorState(monitor.index, true, { skipEvents: true });
            }
        }

        // Emit addition signal
        this._monitorManager.emit('monitor-added', new GLib.Variant('v', monitor));
    }

    async _handleMonitorModified(previousMonitor, currentMonitor) {
        console.log(`[HotplugEventManager] Monitor ${currentMonitor.index} modified`);

        // Check if significant changes require effect reapplication
        const significantChange = (
            previousMonitor.geometry.width !== currentMonitor.geometry.width ||
            previousMonitor.geometry.height !== currentMonitor.geometry.height ||
            previousMonitor.scaleFactor !== currentMonitor.scaleFactor
        );

        if (significantChange && this._effectManager) {
            const stateManager = this._monitorManager._extension.getComponent('StateManager');
            if (stateManager) {
                const currentState = stateManager.getMonitorState(currentMonitor.index);

                if (currentState && this._effectManager.applyMonitorEffect) {
                    // Reapply effect with new geometry
                    await this._effectManager.applyMonitorEffect(currentMonitor.index, false);
                    await this._effectManager.applyMonitorEffect(currentMonitor.index, true);
                }
            }
        }

        // Emit change signal
        this._monitorManager.emit('monitor-changed', currentMonitor.index,
            new GLib.Variant('v', {
                previous: previousMonitor,
                current: currentMonitor,
            }),
        );
    }

    async _attemptRecovery() {
        console.log('[HotplugEventManager] Attempting recovery from hotplug error');

        try {
            // Clear all effects
            if (this._effectManager && this._effectManager.removeAllEffects) {
                await this._effectManager.removeAllEffects();
            }

            // Reset to global mode
            const stateManager = this._monitorManager._extension.getComponent('StateManager');
            if (stateManager && stateManager.updateSetting) {
                await stateManager.updateSetting('per-monitor-mode', false);

                // Reapply based on global state
                const globalState = stateManager.getGrayscaleState();
                if (globalState && this._effectManager && this._effectManager.applyGlobalEffect) {
                    await this._effectManager.applyGlobalEffect(true);
                }
            }

            console.log('[HotplugEventManager] Recovery completed');

        } catch (recoveryError) {
            console.error('[HotplugEventManager] Recovery failed:', recoveryError);
        }
    }
}
