/**
 * Monitor Manager for GNOME Shell Grayscale Toggle Extension
 * Multi-monitor detection, hotplug event handling, and display management
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import type { ExtensionComponent } from './types/extension.js';
import type {
    MonitorManager as IMonitorManager,
    MonitorChangeEvent,
    MonitorDetection,
    MonitorInfo,
} from './types/monitors.js';

// Extension interface for component access
interface Extension {
    getComponent(name: string): any;
}

// Detection results interface
interface DetectionResult {
    monitors: MonitorInfo[];
    changes: MonitorChanges;
}

// Monitor changes interface
interface MonitorChanges {
    added: MonitorInfo[];
    removed: MonitorInfo[];
    modified: Array<{ previous: MonitorInfo; current: MonitorInfo }>;
}

// Signal connection interface
interface SignalConnection {
    object: any;
    signalId: number;
}

// Hotplug event interface
interface HotplugEvent {
    type: string;
    data: any;
    timestamp: number;
}

export const MonitorManager = GObject.registerClass(
    {
        GTypeName: 'GrayscaleMonitorManager',
        Signals: {
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
        },
    },
    class MonitorManager extends GObject.Object implements IMonitorManager, ExtensionComponent {
        private _extension: Extension;
        private _monitors: Map<number, MonitorInfo>;
        private _layoutManager: any = null; // Main.layoutManager type
        private _hotplugManager: HotplugEventManager | null = null;
        private _detectionEngine: AdvancedMonitorDetection;
        private _signalConnections: SignalConnection[];
        private _lastScanTime: number;
        private _scanCount: number;
        private _initialized: boolean;

        constructor(extension: Extension) {
            super();

            this._extension = extension;
            this._monitors = new Map();
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
        async initialize(): Promise<boolean> {
            if (this._initialized) {
                return true;
            }

            try {
                console.log('[MonitorManager] Initializing...');

                this._layoutManager = Main.layoutManager;
                this._hotplugManager = new HotplugEventManager(
                    this,
                    this._extension.getComponent('EffectManager')
                );

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

        enable(): void {
            this.initialize().catch(error => {
                console.error('[MonitorManager] Failed to enable:', error);
            });
        }

        disable(): void {
            this.destroy();
        }

        destroy(): void {
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
        private async _performInitialScan(): Promise<void> {
            console.log('[MonitorManager] Performing initial monitor scan...');

            const { monitors, changes: _changes } = await this._detectionEngine.detectMonitors();
            this._updateMonitorRegistry(monitors);
            this._processInitialState(monitors);

            this._lastScanTime = Date.now();
            this._scanCount++;

            console.log(
                `[MonitorManager] Initial scan complete: ${monitors.length} monitors detected`
            );
        }

        async rescanMonitors(): Promise<DetectionResult> {
            console.log('[MonitorManager] Rescanning monitors...');

            const { monitors, changes } = await this._detectionEngine.detectMonitors();
            this._updateMonitorRegistry(monitors);

            this._lastScanTime = Date.now();
            this._scanCount++;

            return { monitors: Array.from(this._monitors.values()), changes };
        }

        private _updateMonitorRegistry(monitors: MonitorInfo[]): void {
            // Clear existing monitors
            this._monitors.clear();

            // Add detected monitors
            monitors.forEach(monitor => {
                this._monitors.set(monitor.index, {
                    ...monitor,
                    lastSeen: Date.now(),
                    active: true,
                } as MonitorInfo);
            });
        }

        private _processInitialState(monitors: MonitorInfo[]): void {
            const stateManager = this._extension.getComponent('StateManager');
            if (!stateManager) {
                return;
            }

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
        get monitors(): MonitorInfo[] {
            return Array.from(this._monitors.values());
        }

        get primary(): MonitorInfo | null {
            return Array.from(this._monitors.values()).find(monitor => monitor.isPrimary) || null;
        }

        getActiveMonitors(): MonitorInfo[] {
            return Array.from(this._monitors.values()).filter(monitor => monitor.active);
        }

        getMonitorCount(): number {
            return this._monitors.size;
        }

        getMonitor(index: number): MonitorInfo | null {
            return this._monitors.get(index) || null;
        }

        getMonitorInfo(index: number): MonitorInfo | null {
            return this._monitors.get(index) || null;
        }

        getAllMonitors(): MonitorInfo[] {
            return Array.from(this._monitors.values());
        }

        getMonitorActor(index: number): any {
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

        getGlobalStage(): any {
            return global.stage;
        }

        getPrimaryMonitor(): MonitorInfo | null {
            return Array.from(this._monitors.values()).find(monitor => monitor.isPrimary) || null;
        }

        // Monitor properties
        hasMultipleMonitors(): boolean {
            return this._monitors.size > 1;
        }

        isValidMonitorIndex(index: number): boolean {
            return this._monitors.has(index);
        }

        refresh(): void {
            this.rescanMonitors().catch(error => {
                console.error('[MonitorManager] Failed to refresh monitors:', error);
            });
        }

        // Signal management
        private _disconnectSignals(): void {
            this._signalConnections.forEach(({ object, signalId }) => {
                if (object && signalId) {
                    object.disconnect(signalId);
                }
            });
            this._signalConnections = [];
        }

        // Events for external components
        connectSignal(signal: string, callback: (event: MonitorChangeEvent) => void): number {
            return (super.connect as any)(signal, callback);
        }

        disconnectSignal(id: number): void {
            (super.disconnect as any)(id);
        }

        onMonitorAdded(callback: (event: MonitorChangeEvent) => void): number {
            return this.connectSignal('monitor-added', callback);
        }

        onMonitorRemoved(callback: (event: MonitorChangeEvent) => void): number {
            return this.connectSignal('monitor-removed', callback);
        }

        onMonitorChanged(callback: (event: MonitorChangeEvent) => void): number {
            return this.connectSignal('monitor-changed', callback);
        }

        onMonitorsReconfigured(callback: (event: MonitorChangeEvent) => void): number {
            return this.connectSignal('monitors-reconfigured', callback);
        }
    }
);

// Instance type alias for helper classes
type MonitorManagerType = InstanceType<typeof MonitorManager>;

// Advanced monitor detection engine
class AdvancedMonitorDetection implements MonitorDetection {
    private _detectionMethods: Array<() => Promise<MonitorInfo[]>>;
    private _lastDetectedMonitors: Map<number, MonitorInfo>;

    constructor() {
        this._detectionMethods = [
            this._detectViaLayoutManager.bind(this),
            this._detectViaMetaDisplay.bind(this),
            this._detectViaConnectors.bind(this),
        ];
        this._lastDetectedMonitors = new Map();
    }

    async detectMonitors(): Promise<DetectionResult> {
        const detectionResults: MonitorInfo[][] = [];

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
            consolidatedMonitors.map(monitor => [monitor.index, monitor])
        );

        return { monitors: consolidatedMonitors, changes };
    }

    watchChanges(_callback: (monitors: MonitorInfo[]) => void): () => void {
        // This would be implemented as a polling mechanism or signal watching
        // For now, return a no-op cleanup function
        return () => {};
    }

    private async _detectViaLayoutManager(): Promise<MonitorInfo[]> {
        const layoutManager = Main.layoutManager;
        const monitors: MonitorInfo[] = [];

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
                scale: (monitor as any).geometry_scale || 1.0,
                name: this._getConnectorName(i),
                actor: monitor,
                manufacturer: undefined,
                model: undefined,
                serial: undefined,
            });
        }

        return monitors;
    }

    private async _detectViaMetaDisplay(): Promise<MonitorInfo[]> {
        const display = global.display;
        const monitors: MonitorInfo[] = [];

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
                scale,
                name: `META-${i}`,
                manufacturer: undefined,
                model: undefined,
                serial: undefined,
            });
        }

        return monitors;
    }

    private async _detectViaConnectors(): Promise<MonitorInfo[]> {
        // Fallback method - minimal implementation
        try {
            const backend = (Meta as any).get_backend();
            const _monitorManager = backend.get_monitor_manager();
            // This method provides additional validation but may not be available
            // on all systems, so it's used as a fallback/verification method
            return [];
        } catch {
            return [];
        }
    }

    private _consolidateDetectionResults(results: MonitorInfo[][]): MonitorInfo[] {
        if (results.length === 0) {
            return [];
        }

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

    private _calculateAverageConfidence(monitors: MonitorInfo[]): number {
        if (!monitors || monitors.length === 0) {
            return 0;
        }
        const totalConfidence = monitors.reduce((sum, _monitor) => sum + 0.5, 0); // Default confidence
        return totalConfidence / monitors.length;
    }

    private _detectChanges(newMonitors: MonitorInfo[]): MonitorChanges {
        const changes: MonitorChanges = {
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
                const lastMonitor = this._lastDetectedMonitors.get(monitor.index)!;
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

    private _hasMonitorChanged(previous: MonitorInfo, current: MonitorInfo): boolean {
        return (
            previous.geometry.x !== current.geometry.x ||
            previous.geometry.y !== current.geometry.y ||
            previous.geometry.width !== current.geometry.width ||
            previous.geometry.height !== current.geometry.height ||
            previous.scale !== current.scale ||
            previous.isPrimary !== current.isPrimary
        );
    }

    private _getConnectorName(index: number): string {
        // Attempt to get real connector name
        try {
            const backend = (Meta as any).get_backend();
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
    private _monitorManager: MonitorManagerType;
    private _effectManager: any;
    private _pendingOperations: Map<string, any>;
    private _debounceTimer: any = null;
    private _eventQueue: HotplugEvent[];
    private _signalConnections: SignalConnection[];

    constructor(monitorManager: MonitorManagerType, effectManager: any) {
        this._monitorManager = monitorManager;
        this._effectManager = effectManager;
        this._pendingOperations = new Map();
        this._debounceTimer = null;
        this._eventQueue = [];
        this._signalConnections = [];
    }

    async initialize(): Promise<void> {
        console.log('[HotplugEventManager] Initializing...');

        // Connect to layout manager signals
        const layoutChangeSignal = Main.layoutManager.connect('monitors-changed', () =>
            this._handleMonitorsChanged()
        );
        this._signalConnections.push({
            object: Main.layoutManager,
            signalId: layoutChangeSignal,
        });

        console.log('[HotplugEventManager] Initialized');
    }

    destroy(): void {
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

    private _handleMonitorsChanged(): void {
        console.log('[HotplugEventManager] Layout monitors changed');
        this._queueEvent('layout-changed', { source: 'layout-manager', timestamp: Date.now() });
        this._debounceProcessing();
    }

    private _handleDisplayConfigChanged(): void {
        console.log('[HotplugEventManager] Display configuration changed');
        this._queueEvent('display-config-changed', {
            source: 'meta-display',
            timestamp: Date.now(),
        });
        this._debounceProcessing();
    }

    private _queueEvent(type: string, data: any): void {
        this._eventQueue.push({ type, data, timestamp: Date.now() });

        // Limit queue size
        if (this._eventQueue.length > 10) {
            this._eventQueue = this._eventQueue.slice(-10);
        }
    }

    private _debounceProcessing(): void {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        this._debounceTimer = setTimeout(() => {
            this._processHotplugEvents();
            this._debounceTimer = null;
        }, 500); // 500ms debounce
    }

    private async _processHotplugEvents(): Promise<void> {
        if (this._eventQueue.length === 0) {
            return;
        }

        console.log(`[HotplugEventManager] Processing ${this._eventQueue.length} events`);

        try {
            // Suspend effects during reconfiguration
            if (this._effectManager && this._effectManager.suspendEffects) {
                await this._effectManager.suspendEffects();
            }

            // Rescan monitors
            const { changes } = await this._monitorManager.rescanMonitors();

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

    private async _processMonitorChanges(changes: MonitorChanges): Promise<void> {
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

    private async _handleMonitorRemoved(monitor: MonitorInfo): Promise<void> {
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
        (this._monitorManager as any).emit('monitor-removed', monitor.index);
    }

    private async _handleMonitorAdded(monitor: MonitorInfo): Promise<void> {
        console.log(`[HotplugEventManager] Monitor ${monitor.index} added`);

        // Initialize monitor state
        const stateManager = (this._monitorManager as any)._extension.getComponent('StateManager');
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
        (this._monitorManager as any).emit(
            'monitor-added',
            new GLib.Variant('v', new GLib.Variant('a{sv}', {}))
        );
    }

    private async _handleMonitorModified(
        previousMonitor: MonitorInfo,
        currentMonitor: MonitorInfo
    ): Promise<void> {
        console.log(`[HotplugEventManager] Monitor ${currentMonitor.index} modified`);

        // Check if significant changes require effect reapplication
        const significantChange =
            previousMonitor.geometry.width !== currentMonitor.geometry.width ||
            previousMonitor.geometry.height !== currentMonitor.geometry.height ||
            previousMonitor.scale !== currentMonitor.scale;

        if (significantChange && this._effectManager) {
            const stateManager = (this._monitorManager as any)._extension.getComponent(
                'StateManager'
            );
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
        (this._monitorManager as any).emit(
            'monitor-changed',
            currentMonitor.index,
            new GLib.Variant('v', new GLib.Variant('a{sv}', {}))
        );
    }

    private async _attemptRecovery(): Promise<void> {
        console.log('[HotplugEventManager] Attempting recovery from hotplug error');

        try {
            // Clear all effects
            if (this._effectManager && this._effectManager.removeAllEffects) {
                await this._effectManager.removeAllEffects();
            }

            // Reset to global mode
            const stateManager = (this._monitorManager as any)._extension.getComponent(
                'StateManager'
            );
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
