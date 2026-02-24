/**
 * State management type definitions
 */

import type { GrayscaleSettings } from './settings.js';
import type { MonitorInfo } from './monitors.js';
import type { EffectState } from './effects.js';

// Core extension state interface
export interface ExtensionState {
    isActive: boolean;
    isEnabled: boolean;
    currentSettings: GrayscaleSettings;
    monitors: MonitorInfo[];
    effects: Map<number, EffectState>;
    lastToggleTime: number;
}

// State change event data
export interface StateChangeEvent {
    type: 'toggle' | 'settings' | 'monitor' | 'effect';
    oldState: Partial<ExtensionState>;
    newState: Partial<ExtensionState>;
    timestamp: number;
}

// State manager interface
export interface StateManager {
    readonly state: ExtensionState;
    toggle(): void;
    updateSettings(settings: Partial<GrayscaleSettings>): void;
    updateMonitors(monitors: MonitorInfo[]): void;
    updateEffect(monitorIndex: number, effect: EffectState): void;
    connect(signal: string, callback: (event: StateChangeEvent) => void): number;
    disconnect(id: number): void;
    reset(): void;
    destroy(): void;
}

// State persistence interface
export interface StatePersistence {
    save(state: ExtensionState): Promise<void>;
    load(): Promise<ExtensionState | null>;
    clear(): Promise<void>;
}
