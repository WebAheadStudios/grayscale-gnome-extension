/**
 * Settings and configuration type definitions
 */

// GSettings schema interface
export interface GrayscaleSettings {
    enabled: boolean;
    brightness: number;
    contrast: number;
    keybinding: string[];
    showIndicator: boolean;
    quickSettingsEnabled: boolean;
    autoDetectMonitors: boolean;
    perMonitorSettings: boolean;
}

// Settings change event data
export interface SettingsChangeEvent {
    key: keyof GrayscaleSettings;
    oldValue: unknown;
    newValue: unknown;
    timestamp: number;
}

// Settings controller interface
export interface SettingsController {
    readonly settings: GrayscaleSettings;
    get<K extends keyof GrayscaleSettings>(key: K): GrayscaleSettings[K];
    set<K extends keyof GrayscaleSettings>(key: K, value: GrayscaleSettings[K]): void;
    connect(signal: string, callback: (event: SettingsChangeEvent) => void): number;
    disconnect(id: number): void;
    reset(): void;
    destroy(): void;
}

// Schema validation interface
export interface SettingsSchema {
    readonly path: string;
    readonly id: string;
    validate(settings: Partial<GrayscaleSettings>): boolean;
    getDefaults(): GrayscaleSettings;
}
