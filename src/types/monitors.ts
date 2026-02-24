/**
 * Monitor and display management type definitions
 */

// Monitor geometry information
export interface MonitorGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Monitor information interface
export interface MonitorInfo {
    index: number;
    isPrimary: boolean;
    geometry: MonitorGeometry;
    scale: number;
    name?: string;
    manufacturer?: string;
    model?: string;
    serial?: string;
}

// Monitor change event data
export interface MonitorChangeEvent {
    type: 'added' | 'removed' | 'changed' | 'primary-changed';
    monitor: MonitorInfo;
    allMonitors: MonitorInfo[];
    timestamp: number;
}

// Monitor manager interface
export interface MonitorManager {
    readonly monitors: MonitorInfo[];
    readonly primary: MonitorInfo | null;
    getMonitor(index: number): MonitorInfo | null;
    getPrimaryMonitor(): MonitorInfo | null;
    connect(signal: string, callback: (event: MonitorChangeEvent) => void): number;
    disconnect(id: number): void;
    refresh(): void;
    destroy(): void;
}

// Monitor detection interface for different backends
export interface MonitorDetection {
    detectMonitors(): Promise<MonitorInfo[]>;
    watchChanges(callback: (monitors: MonitorInfo[]) => void): () => void;
}
