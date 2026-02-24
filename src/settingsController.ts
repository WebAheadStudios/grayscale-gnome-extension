/**
 * Settings Controller for GNOME Shell Grayscale Toggle Extension
 * Handles GSettings schema integration and configuration management
 */

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import type { ExtensionComponent } from './types/extension.js';

// Extension interface for basic typing
interface Extension {
    getSettings(): Gio.Settings;
}

// Settings operation options interface
interface SettingsOperationOptions {
    skipValidation?: boolean;
    skipEvents?: boolean;
    atomic?: boolean;
}

// Validation rule function type
type ValidationRule<T = unknown> = (value: T) => boolean;

// Setting with invalid value interface
interface InvalidSetting {
    key: string;
    value: unknown;
}

export class SettingsController extends GObject.Object implements ExtensionComponent {
    static [GObject.signals] = {
        'setting-changed': {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_VARIANT],
        },
    };

    private _extension: Extension;
    private _settings: Gio.Settings | null;
    private _connections: Map<string, number>;
    private _initialized: boolean;
    private _validationRules: Map<string, ValidationRule>;

    constructor(extension: Extension) {
        super();

        this._extension = extension;
        this._settings = null;
        this._connections = new Map();
        this._initialized = false;
        this._validationRules = new Map();

        this._setupValidationRules();
    }

    // Initialization
    async initialize(): Promise<boolean> {
        if (this._initialized) {
            return true;
        }

        try {
            // Get extension settings
            this._settings = this._extension.getSettings();

            if (!this._settings) {
                throw new Error('Failed to initialize GSettings');
            }

            // Connect to all setting changes
            this._connectSettings();

            // Validate current settings
            await this._validateAllSettings();

            this._initialized = true;
            console.log('[SettingsController] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[SettingsController] Initialization failed:', error);
            throw error;
        }
    }

    enable(): void {
        this.initialize().catch(error => {
            console.error('[SettingsController] Failed to enable:', error);
        });
    }

    disable(): void {
        this.destroy();
    }

    destroy(): void {
        if (!this._initialized) {
            return;
        }

        // Disconnect all signal connections
        this._disconnectSettings();

        // Clear references
        this._settings = null;
        this._connections.clear();
        this._validationRules.clear();
        this._initialized = false;

        console.log('[SettingsController] Destroyed successfully');
    }

    // Settings API - renamed to avoid conflicts with GObject methods
    getSettings(): Record<string, unknown> {
        return this.getAllSettings();
    }

    getSetting(key: string): unknown {
        if (!this._settings) {
            console.warn(
                `[SettingsController] Attempting to get setting '${key}' before initialization`
            );
            return null;
        }

        try {
            const schemaKey = this._settings.settings_schema.get_key(key);
            if (!schemaKey) {
                console.warn(`[SettingsController] Unknown setting key: ${key}`);
                return null;
            }

            const variant = this._settings.get_value(key);
            return this._unpackVariant(variant);
        } catch (error) {
            console.error(`[SettingsController] Error getting setting '${key}':`, error);
            return null;
        }
    }

    async setSetting(
        key: string,
        value: unknown,
        options: SettingsOperationOptions = {}
    ): Promise<boolean> {
        const { skipValidation = false, skipEvents = false } = options;

        if (!this._settings) {
            throw new Error('Settings controller not initialized');
        }

        try {
            // Validate setting value
            if (!skipValidation && !this._validateSetting(key, value)) {
                throw new Error(`Invalid value for setting '${key}': ${value}`);
            }

            const schemaKey = this._settings.settings_schema.get_key(key);
            if (!schemaKey) {
                throw new Error(`Unknown setting key: ${key}`);
            }

            // Convert value to proper variant type
            const variant = this._packVariant(value, schemaKey.get_value_type());

            // Set the value
            const previousValue = this.getSetting(key);
            const success = this._settings.set_value(key, variant);

            if (!success) {
                throw new Error(`Failed to set setting '${key}'`);
            }

            // Sync settings to disk
            Gio.Settings.sync();

            // Emit change event if value actually changed
            if (!skipEvents && !this._valuesEqual(previousValue, value)) {
                (this as any).emit('setting-changed', key, variant);
            }

            return true;
        } catch (error) {
            console.error(`[SettingsController] Error setting '${key}' to '${value}':`, error);
            throw error;
        }
    }

    resetSetting(key: string): boolean {
        if (!this._settings) {
            throw new Error('Settings controller not initialized');
        }

        try {
            this._settings.reset(key);
            Gio.Settings.sync();

            const newValue = this.getSetting(key);
            (this as any).emit('setting-changed', key, this._settings.get_value(key));

            console.log(`[SettingsController] Reset setting '${key}' to default value:`, newValue);
            return true;
        } catch (error) {
            console.error(`[SettingsController] Error resetting setting '${key}':`, error);
            throw error;
        }
    }

    getAllSettings(): Record<string, unknown> {
        if (!this._settings) {
            return {};
        }

        const settings: Record<string, unknown> = {};
        const keys = this._settings.settings_schema.list_keys();

        for (const key of keys) {
            settings[key] = this.getSetting(key);
        }

        return settings;
    }

    // Batch operations
    async setMultipleSettings(
        settingsMap: Record<string, unknown>,
        options: SettingsOperationOptions = {}
    ): Promise<void> {
        const { atomic = true } = options;

        if (!this._settings) {
            throw new Error('Settings controller not initialized');
        }

        if (atomic) {
            // Use delay/apply pattern for atomic updates
            this._settings.delay();

            try {
                for (const [key, value] of Object.entries(settingsMap)) {
                    await this.setSetting(key, value, { ...options, skipEvents: true });
                }

                // Apply all changes atomically
                this._settings.apply();

                // Emit events for all changes
                if (!options.skipEvents) {
                    for (const key of Object.keys(settingsMap)) {
                        (this as any).emit('setting-changed', key, this._settings.get_value(key));
                    }
                }
            } catch (error) {
                // Revert all changes on error
                this._settings.revert();
                throw error;
            }
        } else {
            // Non-atomic updates
            for (const [key, value] of Object.entries(settingsMap)) {
                await this.setSetting(key, value, options);
            }
        }
    }

    // Validation
    private _validateSetting(key: string, value: unknown): boolean {
        const validator = this._validationRules.get(key);
        if (!validator) {
            return true; // No validation rule = valid
        }

        try {
            return validator(value);
        } catch (error) {
            console.warn(`[SettingsController] Validation error for '${key}':`, error);
            return false;
        }
    }

    private async _validateAllSettings(): Promise<void> {
        console.log('[SettingsController] Validating all settings...');

        if (!this._settings) {
            return;
        }

        const keys = this._settings.settings_schema.list_keys();
        const invalidSettings: InvalidSetting[] = [];

        for (const key of keys) {
            const value = this.getSetting(key);
            if (!this._validateSetting(key, value)) {
                invalidSettings.push({ key, value });
            }
        }

        if (invalidSettings.length > 0) {
            console.warn('[SettingsController] Found invalid settings:', invalidSettings);

            // Reset invalid settings to defaults
            for (const { key } of invalidSettings) {
                try {
                    this.resetSetting(key);
                    console.log(`[SettingsController] Reset invalid setting: ${key}`);
                } catch (error) {
                    console.error(`[SettingsController] Failed to reset setting '${key}':`, error);
                }
            }
        }
    }

    private _setupValidationRules(): void {
        // Boolean settings
        this._validationRules.set(
            'grayscale-enabled',
            (value): value is boolean => typeof value === 'boolean'
        );
        this._validationRules.set(
            'show-panel-indicator',
            (value): value is boolean => typeof value === 'boolean'
        );
        this._validationRules.set(
            'show-notifications',
            (value): value is boolean => typeof value === 'boolean'
        );
        this._validationRules.set(
            'performance-mode',
            (value): value is boolean => typeof value === 'boolean'
        );
        this._validationRules.set(
            'per-monitor-mode',
            (value): value is boolean => typeof value === 'boolean'
        );
        this._validationRules.set(
            'auto-enable-on-startup',
            (value): value is boolean => typeof value === 'boolean'
        );
        this._validationRules.set(
            'global-enabled',
            (value): value is boolean => typeof value === 'boolean'
        );

        // Numeric settings
        this._validationRules.set(
            'animation-duration',
            (value): value is number => typeof value === 'number' && value >= 0.0 && value <= 2.0
        );

        // String settings with choices
        this._validationRules.set(
            'effect-quality',
            (value): value is string =>
                typeof value === 'string' && ['low', 'medium', 'high'].includes(value)
        );

        // Array settings
        this._validationRules.set(
            'toggle-keybinding',
            (value): value is string[] =>
                Array.isArray(value) && value.every(item => typeof item === 'string')
        );

        // Dictionary settings
        this._validationRules.set(
            'monitor-states',
            (value): value is Record<string, unknown> => value !== null && typeof value === 'object'
        );
        this._validationRules.set(
            'performance-metrics',
            (value): value is Record<string, unknown> => value !== null && typeof value === 'object'
        );
    }

    // Signal handling
    private _connectSettings(): void {
        if (!this._settings) {
            return;
        }

        // Connect to changed signals for all keys
        const keys = this._settings.settings_schema.list_keys();

        for (const key of keys) {
            const signalId = this._settings.connect(
                `changed::${key}`,
                (settings: Gio.Settings, changedKey: string) => {
                    const variant = settings.get_value(changedKey);
                    (this as any).emit('setting-changed', changedKey, variant);
                }
            );

            this._connections.set(key, signalId);
        }

        console.log(`[SettingsController] Connected to ${keys.length} setting change signals`);
    }

    private _disconnectSettings(): void {
        if (!this._settings) {
            return;
        }

        for (const [key, signalId] of this._connections) {
            this._settings.disconnect(signalId);
        }

        this._connections.clear();
        console.log('[SettingsController] Disconnected all setting signals');
    }

    // Utility methods
    private _unpackVariant(variant: GLib.Variant): unknown {
        if (!variant) {
            return null;
        }

        const typeString = variant.get_type_string();

        switch (typeString) {
            case 'b':
                return variant.get_boolean();
            case 'd':
                return variant.get_double();
            case 's':
                return variant.get_string()[0];
            case 'as':
                return variant.get_strv();
            case 'a{ib}':
            case 'a{sv}':
                return variant.unpack();
            default:
                console.warn(`[SettingsController] Unhandled variant type: ${typeString}`);
                return variant.unpack();
        }
    }

    private _packVariant(value: unknown, type: GLib.VariantType): GLib.Variant {
        const typeString = type.dup_string();

        switch (typeString) {
            case 'b':
                return new GLib.Variant('b', value as boolean);
            case 'd':
                return new GLib.Variant('d', value as number);
            case 's':
                return new GLib.Variant('s', value as string);
            case 'as':
                return new GLib.Variant('as', value as string[]);
            case 'a{ib}':
                return new GLib.Variant('a{ib}', value as Record<number, boolean>);
            case 'a{sv}':
                return new GLib.Variant('a{sv}', value as Record<string, GLib.Variant>);
            default:
                throw new Error(`Unsupported variant type: ${typeString}`);
        }
    }

    private _valuesEqual(value1: unknown, value2: unknown): boolean {
        if (value1 === value2) {
            return true;
        }

        if (Array.isArray(value1) && Array.isArray(value2)) {
            return value1.length === value2.length && value1.every((v, i) => v === value2[i]);
        }

        if (
            typeof value1 === 'object' &&
            typeof value2 === 'object' &&
            value1 !== null &&
            value2 !== null
        ) {
            const keys1 = Object.keys(value1);
            const keys2 = Object.keys(value2);

            if (keys1.length !== keys2.length) {
                return false;
            }

            return keys1.every(
                key =>
                    (value1 as Record<string, unknown>)[key] ===
                    (value2 as Record<string, unknown>)[key]
            );
        }

        return false;
    }

    // Convenience methods
    isEnabled(): boolean {
        return (this.getSetting('grayscale-enabled') as boolean) || false;
    }

    async setEnabled(enabled: boolean): Promise<boolean> {
        return await this.setSetting('grayscale-enabled', enabled);
    }

    getKeybinding(): string[] {
        return (this.getSetting('toggle-keybinding') as string[]) || ['<Super>g'];
    }

    async setKeybinding(keybinding: string[]): Promise<boolean> {
        return await this.setSetting('toggle-keybinding', keybinding);
    }

    // Debugging
    dumpSettings(): void {
        console.log('[SettingsController] Current settings:');
        const settings = this.getAllSettings();

        for (const [key, value] of Object.entries(settings)) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
    }
}
