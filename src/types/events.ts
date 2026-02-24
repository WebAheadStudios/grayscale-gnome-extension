/**
 * Event system and signal handling type definitions
 */

// Base event interface
export interface BaseEvent {
    type: string;
    timestamp: number;
    source?: string;
}

// Event emitter interface for component communication
export interface EventEmitter {
    connect(signal: string, callback: (...args: any[]) => void): number;
    disconnect(id: number): void;
    emit(signal: string, ...args: any[]): void;
    hasSignal(signal: string): boolean;
    destroy(): void;
}

// Signal connection interface
export interface SignalConnection {
    readonly id: number;
    readonly signal: string;
    readonly callback: (...args: any[]) => void;
    readonly source: any;
    disconnect(): void;
}

// Signal manager for handling GNOME Shell signals
export interface SignalManager {
    readonly connections: Map<number, SignalConnection>;
    connect(source: any, signal: string, callback: (...args: any[]) => void): number;
    disconnect(id: number): void;
    disconnectAll(): void;
    destroy(): void;
}

// Keyboard shortcut event
export interface KeyboardEvent extends BaseEvent {
    type: 'keyboard';
    key: string;
    modifiers: string[];
    action: 'pressed' | 'released';
}

// User interaction events
export interface UserInteractionEvent extends BaseEvent {
    type: 'user-interaction';
    action: 'toggle' | 'settings-opened' | 'menu-clicked' | 'quick-settings-toggled';
    data?: any;
}
