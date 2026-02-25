/**
 * UI Controller for GNOME Shell Grayscale Toggle Extension
 * Manages all UI components including keyboard shortcuts, Quick Settings, and panel indicator
 */

import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Import UI components - will be TypeScript after conversion
import { PanelIndicator } from './panelIndicator.js';
import { QuickSettingsIntegration } from './quickSettingsIntegration.js';

import type { ExtensionComponent } from './types/extension.js';
import type {
    PanelIndicator as IPanelIndicator,
    UIController as IUIController,
    QuickSettingsToggle,
} from './types/ui.js';

// Extension interface for component access
interface Extension {
    getComponent(name: string): any;
    getSettings(): any; // Gio.Settings
}

// UI preferences interface
interface UIPreferences {
    showPanelIndicator: boolean;
    showQuickSettings: boolean;
    panelPosition: string;
    showNotifications: boolean;
    notificationTimeout: number;
}

// Keyboard shortcut data
interface KeyboardShortcut {
    actionId: number;
    accelerators: string[];
}

// Notification data
interface NotificationData {
    context: Record<string, any>;
}

export const UIController = GObject.registerClass(
    {
        GTypeName: 'GrayscaleUIController',
        Signals: {
            'toggle-requested': {
                param_types: [GObject.TYPE_STRING],
            },
            'shortcuts-changed': {
                param_types: [GObject.TYPE_VARIANT],
            },
            'ui-state-changed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_BOOLEAN],
            },
        },
    },
    class UIController extends GObject.Object implements IUIController, ExtensionComponent {
        private _extension: Extension;
        private _stateManager: any = null;
        private _settingsController: any = null;
        private _keyboardShortcuts: Map<string, KeyboardShortcut>;
        private _notifications: Map<string, NotificationData>;
        private _initialized: boolean;

        // UI component managers
        private _quickSettings: any = null; // QuickSettingsIntegration
        private _panelIndicator: any = null; // PanelIndicator
        private _uiComponentsEnabled: boolean;

        // UI preferences
        private _uiPreferences: UIPreferences;

        constructor(extension: Extension) {
            super();

            this._extension = extension;
            this._stateManager = null;
            this._settingsController = null;
            this._keyboardShortcuts = new Map();
            this._notifications = new Map();
            this._initialized = false;

            // UI component managers
            this._quickSettings = null;
            this._panelIndicator = null;
            this._uiComponentsEnabled = false;

            // UI preferences
            this._uiPreferences = {
                showPanelIndicator: true,
                showQuickSettings: true,
                panelPosition: 'right',
                showNotifications: true,
                notificationTimeout: 3000,
            };
        }

        // Initialization
        async initialize(): Promise<boolean> {
            if (this._initialized) {
                return true;
            }

            try {
                // Get component references
                this._stateManager = this._extension.getComponent('StateManager');
                this._settingsController = this._extension.getComponent('SettingsController');

                if (!this._stateManager || !this._settingsController) {
                    throw new Error('Required components not available');
                }

                // Load UI preferences from settings
                this._loadUIPreferences();

                // Setup keyboard shortcuts
                await this._setupKeyboardShortcuts();

                // Initialize UI components
                await this._initializeUIComponents();

                // Connect to state changes for notifications
                this._connectStateSignals();

                // Connect to settings changes for UI updates
                this._connectUISettingsSignals();

                this._initialized = true;
                console.log('[UIController] Initialized successfully');
                return true;
            } catch (error) {
                console.error('[UIController] Initialization failed:', error);
                throw error;
            }
        }

        enable(): void {
            this.initialize().catch(error => {
                console.error('[UIController] Failed to enable:', error);
            });
        }

        disable(): void {
            this.destroy();
        }

        destroy(): void {
            if (!this._initialized) {
                return;
            }

            // Disable UI components
            this._disableAllUIComponents();

            // Remove all keyboard shortcuts
            this._removeAllKeyboardShortcuts();

            // Clear notifications
            this._clearAllNotifications();

            // Clear references
            this._keyboardShortcuts.clear();
            this._notifications.clear();
            this._stateManager = null;
            this._settingsController = null;
            this._initialized = false;
            this._uiComponentsEnabled = false;

            console.log('[UIController] Destroyed successfully');
        }

        // IUIController implementation
        get panelIndicator(): IPanelIndicator | undefined {
            return this._panelIndicator;
        }

        get quickSettingsToggle(): QuickSettingsToggle | undefined {
            return this._quickSettings;
        }

        showIndicator(): void {
            this._enablePanelIndicator().catch(error => {
                console.error('[UIController] Failed to show indicator:', error);
            });
        }

        hideIndicator(): void {
            this._disablePanelIndicator();
        }

        enableQuickSettings(): void {
            this._enableQuickSettings().catch(error => {
                console.error('[UIController] Failed to enable quick settings:', error);
            });
        }

        disableQuickSettings(): void {
            this._disableQuickSettings();
        }

        updateStatus(active: boolean): void {
            // Update panel indicator if available
            if (this._panelIndicator && this._panelIndicator.updateStatus) {
                this._panelIndicator.updateStatus(active);
            }

            // Update quick settings if available
            if (this._quickSettings && this._quickSettings.updateToggleState) {
                this._quickSettings.updateToggleState(active);
            }
        }

        // Load UI preferences from settings
        private _loadUIPreferences(): void {
            try {
                const settings = this._extension.getSettings();

                this._uiPreferences = {
                    showPanelIndicator: settings.get_boolean('show-panel-indicator') ?? true,
                    showQuickSettings: settings.get_boolean('show-quick-settings') ?? true,
                    panelPosition: settings.get_string('panel-position') ?? 'right',
                    showNotifications: settings.get_boolean('show-notifications') ?? true,
                    notificationTimeout: settings.get_int('notification-timeout') ?? 3000,
                };

                console.log('[UIController] UI preferences loaded:', this._uiPreferences);
            } catch (error) {
                console.warn(
                    '[UIController] Failed to load UI preferences, using defaults:',
                    error
                );
            }
        }

        // Initialize UI components
        private async _initializeUIComponents(): Promise<void> {
            try {
                // Initialize Quick Settings integration
                if (this._uiPreferences.showQuickSettings) {
                    await this._enableQuickSettings();
                }

                // Initialize Panel Indicator
                if (this._uiPreferences.showPanelIndicator) {
                    await this._enablePanelIndicator();
                }

                this._uiComponentsEnabled = true;
                console.log('[UIController] UI components initialized');
            } catch (error) {
                console.error('[UIController] Failed to initialize UI components:', error);
                throw error;
            }
        }

        // Enable Quick Settings integration
        private async _enableQuickSettings(): Promise<void> {
            if (this._quickSettings) {
                console.warn('[UIController] Quick Settings already enabled');
                return;
            }

            try {
                this._quickSettings = new QuickSettingsIntegration(this._extension);
                this._quickSettings.enable();

                (this as any).emit('ui-state-changed', 'quick-settings', true);
                console.log('[UIController] Quick Settings integration enabled');
            } catch (error) {
                console.error('[UIController] Failed to enable Quick Settings:', error);
                // Don't throw - this is optional functionality
            }
        }

        // Disable Quick Settings integration
        private _disableQuickSettings(): void {
            if (!this._quickSettings) {
                return;
            }

            try {
                this._quickSettings.disable();
                this._quickSettings = null;

                (this as any).emit('ui-state-changed', 'quick-settings', false);
                console.log('[UIController] Quick Settings integration disabled');
            } catch (error) {
                console.error('[UIController] Failed to disable Quick Settings:', error);
            }
        }

        // Enable Panel Indicator
        private async _enablePanelIndicator(): Promise<void> {
            if (this._panelIndicator) {
                console.warn('[UIController] Panel Indicator already enabled');
                return;
            }

            try {
                // Create extension object compatible with panel indicator
                const extensionObj = {
                    ...this._extension,
                    getComponent: this._extension.getComponent.bind(this._extension),
                    getSettings: this._extension.getSettings.bind(this._extension),
                };
                this._panelIndicator = new PanelIndicator(extensionObj as any);
                this._panelIndicator.enable();

                (this as any).emit('ui-state-changed', 'panel-indicator', true);
                console.log('[UIController] Panel Indicator enabled');
            } catch (error) {
                console.error('[UIController] Failed to enable Panel Indicator:', error);
                // Don't throw - this is optional functionality
            }
        }

        // Disable Panel Indicator
        private _disablePanelIndicator(): void {
            if (!this._panelIndicator) {
                return;
            }

            try {
                this._panelIndicator.disable();
                this._panelIndicator = null;

                (this as any).emit('ui-state-changed', 'panel-indicator', false);
                console.log('[UIController] Panel Indicator disabled');
            } catch (error) {
                console.error('[UIController] Failed to disable Panel Indicator:', error);
            }
        }

        // Connect to UI-related settings changes
        private _connectUISettingsSignals(): void {
            const settings = this._extension.getSettings();

            // Panel indicator visibility
            settings.connect('changed::show-panel-indicator', () => {
                const enabled = settings.get_boolean('show-panel-indicator');
                this._uiPreferences.showPanelIndicator = enabled;

                if (enabled) {
                    this._enablePanelIndicator();
                } else {
                    this._disablePanelIndicator();
                }
            });

            // Quick Settings visibility
            settings.connect('changed::show-quick-settings', () => {
                const enabled = settings.get_boolean('show-quick-settings');
                this._uiPreferences.showQuickSettings = enabled;

                if (enabled) {
                    this._enableQuickSettings();
                } else {
                    this._disableQuickSettings();
                }
            });

            // Panel position
            settings.connect('changed::panel-position', () => {
                const position = settings.get_string('panel-position');
                this._uiPreferences.panelPosition = position;

                if (this._panelIndicator && this._panelIndicator.updatePosition) {
                    this._panelIndicator.updatePosition(position);
                }
            });

            // Notification preferences
            settings.connect('changed::show-notifications', () => {
                this._uiPreferences.showNotifications = settings.get_boolean('show-notifications');
            });

            settings.connect('changed::notification-timeout', () => {
                this._uiPreferences.notificationTimeout = settings.get_int('notification-timeout');
            });
        }

        // Disable all UI components
        private _disableAllUIComponents(): void {
            console.log('[UIController] Disabling all UI components...');

            this._disableQuickSettings();
            this._disablePanelIndicator();
        }

        // Public API for UI component management
        toggleUIComponent(componentName: string, enabled: boolean): void {
            switch (componentName) {
                case 'quick-settings':
                    if (enabled) {
                        this._enableQuickSettings();
                    } else {
                        this._disableQuickSettings();
                    }
                    break;
                case 'panel-indicator':
                    if (enabled) {
                        this._enablePanelIndicator();
                    } else {
                        this._disablePanelIndicator();
                    }
                    break;
                default:
                    console.warn(`[UIController] Unknown UI component: ${componentName}`);
            }
        }

        // Get current UI component states
        getUIComponentStates(): Record<string, any> {
            return {
                quickSettings: this._quickSettings ? this._quickSettings.isEnabled : false,
                panelIndicator: this._panelIndicator ? this._panelIndicator.isEnabled : false,
                preferences: this._uiPreferences,
            };
        }

        // Keyboard Shortcut Management
        private async _setupKeyboardShortcuts(): Promise<void> {
            try {
                // Get current keybinding from settings
                const keybinding = this._settingsController.getSetting('toggle-keybinding');

                if (keybinding && Array.isArray(keybinding) && keybinding.length > 0) {
                    await this._registerGlobalToggleShortcut(keybinding);
                }

                // Listen for keybinding changes
                this._settingsController.connect(
                    'setting-changed',
                    (controller: any, key: string, variant: any) => {
                        if (key === 'toggle-keybinding') {
                            this._handleKeybindingChange(variant);
                        }
                    }
                );

                console.log('[UIController] Keyboard shortcuts setup completed');
            } catch (error) {
                console.error('[UIController] Failed to setup keyboard shortcuts:', error);
                throw error;
            }
        }

        private async _registerGlobalToggleShortcut(accelerators: string[]): Promise<boolean> {
            try {
                const shortcutName = 'toggle-keybinding';

                // Remove existing shortcut if any
                if (this._keyboardShortcuts.has(shortcutName)) {
                    await this._unregisterShortcut(shortcutName);
                }

                // Register new shortcut
                const actionId = Main.wm.addKeybinding(
                    shortcutName,
                    this._extension.getSettings(),
                    Meta.KeyBindingFlags.NONE,
                    Shell.ActionMode.ALL,
                    () => {
                        console.log('[UIController] Global toggle shortcut activated');
                        this._handleGlobalToggle();
                    }
                );

                if (actionId !== Meta.KeyBindingAction.NONE) {
                    this._keyboardShortcuts.set(shortcutName, {
                        actionId,
                        accelerators: accelerators.slice(),
                    });

                    console.log(
                        `[UIController] Global toggle shortcut registered: ${accelerators.join(', ')}`
                    );
                    return true;
                } else {
                    throw new Error('Failed to register keyboard shortcut');
                }
            } catch (error) {
                console.error('[UIController] Failed to register global toggle shortcut:', error);
                throw error;
            }
        }

        private async _unregisterShortcut(shortcutName: string): Promise<void> {
            const shortcut = this._keyboardShortcuts.get(shortcutName);
            if (!shortcut) {
                return;
            }

            try {
                Main.wm.removeKeybinding(shortcutName);
                this._keyboardShortcuts.delete(shortcutName);

                console.log(`[UIController] Shortcut unregistered: ${shortcutName}`);
            } catch (error) {
                console.warn(
                    `[UIController] Failed to unregister shortcut ${shortcutName}:`,
                    error
                );
            }
        }

        private _removeAllKeyboardShortcuts(): void {
            console.log('[UIController] Removing all keyboard shortcuts...');

            for (const [shortcutName] of this._keyboardShortcuts) {
                this._unregisterShortcut(shortcutName);
            }
        }

        private async _handleKeybindingChange(variant: any): Promise<void> {
            try {
                const newKeybinding = variant.get_strv();
                console.log(`[UIController] Keybinding changed: ${newKeybinding.join(', ')}`);

                // Re-register the global toggle shortcut with new binding
                await this._registerGlobalToggleShortcut(newKeybinding);

                (this as any).emit('shortcuts-changed', variant);
            } catch (error) {
                console.error('[UIController] Failed to handle keybinding change:', error);
            }
        }

        // Toggle Handlers
        private async _handleGlobalToggle(): Promise<void> {
            try {
                (this as any).emit('toggle-requested', 'keyboard');

                const newState = await this._stateManager.toggleGrayscaleState({
                    source: 'keyboard',
                    animated: true,
                });

                // Show notification if enabled
                if (this._uiPreferences.showNotifications) {
                    this._showToggleNotification(newState, 'keyboard');
                }
            } catch (error) {
                console.error('[UIController] Failed to handle global toggle:', error);
                this._showErrorNotification('Toggle failed', (error as Error).message);
            }
        }

        // Public toggle methods for external use
        async requestToggle(source = 'api'): Promise<boolean> {
            try {
                (this as any).emit('toggle-requested', source);

                const newState = await this._stateManager.toggleGrayscaleState({
                    source,
                    animated: true,
                });

                if (this._uiPreferences.showNotifications) {
                    this._showToggleNotification(newState, source);
                }

                return newState;
            } catch (error) {
                console.error(
                    `[UIController] Failed to handle toggle request from ${source}:`,
                    error
                );
                this._showErrorNotification('Toggle failed', (error as Error).message);
                throw error;
            }
        }

        async requestMonitorToggle(monitorIndex: number, source = 'api'): Promise<boolean> {
            try {
                const currentState = this._stateManager.getMonitorState(monitorIndex);
                const newState = await this._stateManager.setMonitorState(
                    monitorIndex,
                    !currentState,
                    {
                        source,
                    }
                );

                if (this._uiPreferences.showNotifications) {
                    this._showMonitorToggleNotification(monitorIndex, newState, source);
                }

                return newState;
            } catch (error) {
                console.error(
                    `[UIController] Failed to handle monitor ${monitorIndex} toggle:`,
                    error
                );
                this._showErrorNotification('Monitor toggle failed', (error as Error).message);
                throw error;
            }
        }

        // State Change Handling
        private _connectStateSignals(): void {
            this._stateManager.connect(
                'state-changed',
                (manager: any, globalState: boolean, previousState: boolean, options: any) =>
                    this._handleStateChange(globalState, previousState, options)
            );

            this._stateManager.connect(
                'monitor-state-changed',
                (manager: any, monitorIndex: number, enabled: boolean, previousState: any) =>
                    this._handleMonitorStateChange(monitorIndex, enabled, previousState)
            );

            this._stateManager.connect(
                'settings-changed',
                (manager: any, key: string, variant: any) => this._handleSettingChange(key, variant)
            );
        }

        private _handleStateChange(
            globalState: boolean,
            previousState: boolean,
            _options: any
        ): void {
            // Handle visual feedback for state changes
            console.log(
                `[UIController] Global state changed: ${globalState} (was: ${previousState})`
            );

            // Additional UI updates can be added here in later phases
            // For Phase 1, notifications are handled by the toggle methods
        }

        private _handleMonitorStateChange(
            monitorIndex: number,
            enabled: boolean,
            previousState: any
        ): void {
            console.log(
                `[UIController] Monitor ${monitorIndex} state changed: ${enabled} (was: ${previousState})`
            );

            // Additional UI updates can be added here in later phases
        }

        private _handleSettingChange(key: string, variant: any): void {
            if (key === 'show-notifications') {
                const enabled = variant.get_boolean();
                console.log(`[UIController] Notifications ${enabled ? 'enabled' : 'disabled'}`);
            }
        }

        // Notification System
        private _showToggleNotification(enabled: boolean, source: string): void {
            const title = 'Grayscale Toggle';
            const message = enabled ? 'Grayscale enabled' : 'Grayscale disabled';
            const icon = 'display-symbolic';

            this._showNotification('global-toggle', title, message, icon, {
                source,
                state: enabled,
            });
        }

        private _showMonitorToggleNotification(
            monitorIndex: number,
            enabled: boolean,
            source: string
        ): void {
            const title = `Monitor ${monitorIndex + 1}`;
            const message = enabled ? 'Grayscale enabled' : 'Grayscale disabled';
            const icon = 'display-symbolic';

            this._showNotification(`monitor-${monitorIndex}`, title, message, icon, {
                source,
                state: enabled,
                monitor: monitorIndex,
            });
        }

        private _showErrorNotification(title: string, message: string): void {
            this._showNotification('error', title, message, 'dialog-error-symbolic', {
                urgency: 'critical',
            });
        }

        private _showNotification(
            id: string,
            title: string,
            message: string,
            _icon: string,
            context: Record<string, any> = {}
        ): void {
            try {
                // Store reference for tracking
                this._notifications.set(id, { context });

                // Use GNOME 46+ simple notification API
                Main.notify(title, message);
            } catch (error) {
                console.warn(`[UIController] Failed to show notification '${id}':`, error);
            }
        }

        private _clearNotification(id: string): void {
            this._notifications.delete(id);
        }

        private _clearAllNotifications(): void {
            console.log('[UIController] Clearing all notifications...');

            for (const [id] of this._notifications) {
                this._clearNotification(id);
            }
        }

        // Public API
        getRegisteredShortcuts(): Map<string, KeyboardShortcut> {
            return new Map(this._keyboardShortcuts);
        }

        async updateKeybinding(accelerators: string[]): Promise<boolean> {
            try {
                await this._settingsController.setSetting('toggle-keybinding', accelerators);
                console.log(`[UIController] Keybinding updated: ${accelerators.join(', ')}`);
                return true;
            } catch (error) {
                console.error('[UIController] Failed to update keybinding:', error);
                throw error;
            }
        }

        // Test/Debug methods
        async testToggle(): Promise<boolean> {
            console.log('[UIController] Testing toggle functionality...');

            try {
                const result = await this.requestToggle('test');
                console.log(`[UIController] Test toggle result: ${result}`);
                return result;
            } catch (error) {
                console.error('[UIController] Test toggle failed:', error);
                throw error;
            }
        }

        dumpShortcuts(): void {
            console.log('[UIController] Registered shortcuts:');
            for (const [name, shortcut] of this._keyboardShortcuts) {
                console.log(
                    `  ${name}: ${shortcut.accelerators.join(', ')} (ID: ${shortcut.actionId})`
                );
            }
        }
    }
);

export type UIControllerType = InstanceType<typeof UIController>;
