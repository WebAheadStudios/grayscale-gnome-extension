/**
 * Effect management and animation type definitions
 */

import type { MonitorInfo } from './monitors.js';
import type Clutter from 'gi://Clutter';

// Effect configuration interface
export interface EffectConfig {
    desaturation: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    animationDuration: number;
    easing: Clutter.AnimationMode;
}

// Effect state interface
export interface EffectState {
    isActive: boolean;
    config: EffectConfig;
    monitorIndex: number;
    actor?: any; // Clutter.Actor - will be typed properly after GNOME types verification
    timeline?: any; // Clutter.Timeline
    transition?: any; // Clutter.Transition
}

// Effect change event data
export interface EffectChangeEvent {
    type: 'applied' | 'removed' | 'updated' | 'animation-started' | 'animation-completed';
    monitorIndex: number;
    state: EffectState;
    timestamp: number;
}

// Effect manager interface
export interface EffectManager {
    readonly effects: Map<number, EffectState>;
    applyEffect(monitor: MonitorInfo, config: EffectConfig): Promise<void>;
    removeEffect(monitorIndex: number): Promise<void>;
    updateEffect(monitorIndex: number, config: Partial<EffectConfig>): Promise<void>;
    toggleEffect(monitorIndex: number, config?: EffectConfig): Promise<void>;
    connect(signal: string, callback: (event: EffectChangeEvent) => void): number;
    disconnect(id: number): void;
    destroy(): void;
}

// Animation interface for smooth transitions
export interface EffectAnimation {
    readonly isRunning: boolean;
    readonly progress: number;
    start(): Promise<void>;
    stop(): void;
    pause(): void;
    resume(): void;
}
