// UI Controller for GNOME Shell Grayscale Toggle Extension
// Manages all UI components including keyboard shortcuts, Quick Settings, and panel indicator

import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

// Import UI components
import { QuickSettingsIntegration } from './quickSettingsIntegration.js';
import { PanelIndicator } from './panelIndicator.js';

export class UIController extends GObject.Object {
    static [GObject.signals] = {
        'toggle-requested': {
            param_types: [GObject.TYPE_STRING],
        },
        'shortcuts-changed': {
            param_types: [GObject.TYPE_VARIANT],
        },
        'ui-state-changed': {
            param_types: [GObject.TYPE_STRING, GObject.TYPE_BOOLEAN],
        },
    };

    constructor(extension) {
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
    async initialize() {
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

    // Load UI preferences from settings
    _loadUIPreferences() {
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
            console.warn('[UIController] Failed to load UI preferences, using defaults:', error);
        }
    }

    // Initialize UI components
    async _initializeUIComponents() {
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
    async _enableQuickSettings() {
        if (this._quickSettings) {
            console.warn('[UIController] Quick Settings already enabled');
            return;
        }

        try {
            this._quickSettings = new QuickSettingsIntegration(this._extension);
            this._quickSettings.enable();

            this.emit('ui-state-changed', 'quick-settings', true);
            console.log('[UIController] Quick Settings integration enabled');
        } catch (error) {
            console.error('[UIController] Failed to enable Quick Settings:', error);
            // Don't throw - this is optional functionality
        }
    }

    // Disable Quick Settings integration
    _disableQuickSettings() {
        if (!this._quickSettings) {
            return;
        }

        try {
            this._quickSettings.disable();
            this._quickSettings = null;

            this.emit('ui-state-changed', 'quick-settings', false);
            console.log('[UIController] Quick Settings integration disabled');
        } catch (error) {
            console.error('[UIController] Failed to disable Quick Settings:', error);
        }
    }

    // Enable Panel Indicator
    async _enablePanelIndicator() {
        if (this._panelIndicator) {
            console.warn('[UIController] Panel Indicator already enabled');
            return;
        }

        try {
            this._panelIndicator = new PanelIndicator(this._extension);
            this._panelIndicator.enable();

            this.emit('ui-state-changed', 'panel-indicator', true);
            console.log('[UIController] Panel Indicator enabled');
        } catch (error) {
            console.error('[UIController] Failed to enable Panel Indicator:', error);
            // Don't throw - this is optional functionality
        }
    }

    // Disable Panel Indicator
    _disablePanelIndicator() {
        if (!this._panelIndicator) {
            return;
        }

        try {
            this._panelIndicator.disable();
            this._panelIndicator = null;

            this.emit('ui-state-changed', 'panel-indicator', false);
            console.log('[UIController] Panel Indicator disabled');
        } catch (error) {
            console.error('[UIController] Failed to disable Panel Indicator:', error);
        }
    }

    // Connect to UI-related settings changes
    _connectUISettingsSignals() {
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

            if (this._panelIndicator) {
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

    destroy() {
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

    // Disable all UI components
    _disableAllUIComponents() {
        console.log('[UIController] Disabling all UI components...');

        this._disableQuickSettings();
        this._disablePanelIndicator();
    }

    // Public API for UI component management
    toggleUIComponent(componentName, enabled) {
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
    getUIComponentStates() {
        return {
            quickSettings: this._quickSettings ? this._quickSettings.isEnabled : false,
            panelIndicator: this._panelIndicator ? this._panelIndicator.isEnabled : false,
            preferences: this._uiPreferences,
        };
    }

    // Keyboard Shortcut Management
    async _setupKeyboardShortcuts() {
        try {
            // Get current keybinding from settings
            const keybinding = this._settingsController.getSetting('toggle-keybinding');

            if (keybinding && Array.isArray(keybinding) && keybinding.length > 0) {
                await this._registerGlobalToggleShortcut(keybinding);
            }

            // Listen for keybinding changes
            this._settingsController.connect('setting-changed', (controller, key, variant) => {
                if (key === 'toggle-keybinding') {
                    this._handleKeybindingChange(variant);
                }
            });

            console.log('[UIController] Keyboard shortcuts setup completed');
        } catch (error) {
            console.error('[UIController] Failed to setup keyboard shortcuts:', error);
            throw error;
        }
    }

    async _registerGlobalToggleShortcut(accelerators) {
        try {
            const shortcutName = 'toggle-grayscale';

            // Remove existing shortcut if any
            if (this._keyboardShortcuts.has(shortcutName)) {
                await this._unregisterShortcut(shortcutName);
            }

            // Register new shortcut
            const actionId = Main.wm.addKeybinding(shortcutName, this._extension.getSettings(), Meta.KeyBindingFlags.NONE, Shell.ActionMode.ALL, () => {
                console.log('[UIController] Global toggle shortcut activated');
                this._handleGlobalToggle();
            });

            if (actionId !== Meta.KeyBindingAction.NONE) {
                this._keyboardShortcuts.set(shortcutName, {
                    actionId,
                    accelerators: accelerators.slice(),
                });

                console.log(`[UIController] Global toggle shortcut registered: ${accelerators.join(', ')}`);
                return true;
            } else {
                throw new Error('Failed to register keyboard shortcut');
            }
        } catch (error) {
            console.error('[UIController] Failed to register global toggle shortcut:', error);
            throw error;
        }
    }

    async _unregisterShortcut(shortcutName) {
        const shortcut = this._keyboardShortcuts.get(shortcutName);
        if (!shortcut) {
            return;
        }

        try {
            Main.wm.removeKeybinding(shortcutName);
            this._keyboardShortcuts.delete(shortcutName);

            console.log(`[UIController] Shortcut unregistered: ${shortcutName}`);
        } catch (error) {
            console.warn(`[UIController] Failed to unregister shortcut ${shortcutName}:`, error);
        }
    }

    _removeAllKeyboardShortcuts() {
        console.log('[UIController] Removing all keyboard shortcuts...');

        for (const [shortcutName] of this._keyboardShortcuts) {
            this._unregisterShortcut(shortcutName);
        }
    }

    async _handleKeybindingChange(variant) {
        try {
            const newKeybinding = variant.get_strv();
            console.log(`[UIController] Keybinding changed: ${newKeybinding.join(', ')}`);

            // Re-register the global toggle shortcut with new binding
            await this._registerGlobalToggleShortcut(newKeybinding);

            this.emit('shortcuts-changed', variant);
        } catch (error) {
            console.error('[UIController] Failed to handle keybinding change:', error);
        }
    }

    // Toggle Handlers
    async _handleGlobalToggle() {
        try {
            this.emit('toggle-requested', 'keyboard');

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
            this._showErrorNotification('Toggle failed', error.message);
        }
    }

    // Public toggle methods for external use
    async requestToggle(source = 'api') {
        try {
            this.emit('toggle-requested', source);

            const newState = await this._stateManager.toggleGrayscaleState({
                source: source,
                animated: true,
            });

            if (this._uiPreferences.showNotifications) {
                this._showToggleNotification(newState, source);
            }

            return newState;
        } catch (error) {
            console.error(`[UIController] Failed to handle toggle request from ${source}:`, error);
            this._showErrorNotification('Toggle failed', error.message);
            throw error;
        }
    }

    async requestMonitorToggle(monitorIndex, source = 'api') {
        try {
            const newState = await this._stateManager.setMonitorState(monitorIndex, !this._stateManager.getMonitorState(monitorIndex), { source });

            if (this._uiPreferences.showNotifications) {
                this._showMonitorToggleNotification(monitorIndex, newState, source);
            }

            return newState;
        } catch (error) {
            console.error(`[UIController] Failed to handle monitor ${monitorIndex} toggle:`, error);
            this._showErrorNotification('Monitor toggle failed', error.message);
            throw error;
        }
    }

    // State Change Handling
    _connectStateSignals() {
        this._stateManager.connect('state-changed', (manager, globalState, previousState, options) =>
            this._handleStateChange(globalState, previousState, options),
        );

        this._stateManager.connect('monitor-state-changed', (manager, monitorIndex, enabled, previousState) =>
            this._handleMonitorStateChange(monitorIndex, enabled, previousState),
        );

        this._stateManager.connect('settings-changed', (manager, key, variant) => this._handleSettingChange(key, variant));
    }

    _handleStateChange(globalState, previousState, options) {
    // Handle visual feedback for state changes
        console.log(`[UIController] Global state changed: ${globalState} (was: ${previousState})`);

    // Additional UI updates can be added here in later phases
    // For Phase 1, notifications are handled by the toggle methods
    }

    _handleMonitorStateChange(monitorIndex, enabled, previousState) {
        console.log(`[UIController] Monitor ${monitorIndex} state changed: ${enabled} (was: ${previousState})`);

    // Additional UI updates can be added here in later phases
    }

    _handleSettingChange(key, variant) {
        if (key === 'show-notifications') {
            const enabled = variant.get_boolean();
            console.log(`[UIController] Notifications ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    // Notification System
    _showToggleNotification(enabled, source) {
        const title = 'Grayscale Toggle';
        const message = enabled ? 'Grayscale enabled' : 'Grayscale disabled';
        const icon = enabled ? 'display-symbolic' : 'display-symbolic';

        this._showNotification('global-toggle', title, message, icon, {
            source,
            state: enabled,
        });
    }

    _showMonitorToggleNotification(monitorIndex, enabled, source) {
        const title = `Monitor ${monitorIndex + 1}`;
        const message = enabled ? 'Grayscale enabled' : 'Grayscale disabled';
        const icon = 'display-symbolic';

        this._showNotification(`monitor-${monitorIndex}`, title, message, icon, {
            source,
            state: enabled,
            monitor: monitorIndex,
        });
    }

    _showErrorNotification(title, message) {
        this._showNotification('error', title, message, 'dialog-error-symbolic', {
            urgency: 'critical',
        });
    }

    _showNotification(id, title, message, icon, context = {}) {
        try {
            // Clear existing notification with same ID
            this._clearNotification(id);

            // Create notification
            const notification = new Main.messageTray.MessageTraySource(title, icon);
            const message_obj = new Main.messageTray.Notification(notification, title, message);

            // Store reference for cleanup
            this._notifications.set(id, {
                source: notification,
                notification: message_obj,
                context,
            });

            // Show notification
            Main.messageTray.add(notification);
            main.messageTray.banner = message_obj;

            // Auto-hide after configured timeout
            setTimeout(() => {
                this._clearNotification(id);
            }, this._uiPreferences.notificationTimeout);
        } catch (error) {
            console.warn(`[UIController] Failed to show notification '${id}':`, error);
        }
    }

    _clearNotification(id) {
        const notification = this._notifications.get(id);
        if (notification) {
            try {
                if (notification.source) {
                    notification.source.destroy();
                }
                this._notifications.delete(id);
            } catch (error) {
                console.warn(`[UIController] Failed to clear notification '${id}':`, error);
            }
        }
    }

    _clearAllNotifications() {
        console.log('[UIController] Clearing all notifications...');

        for (const [id] of this._notifications) {
            this._clearNotification(id);
        }
    }

    // Public API
    getRegisteredShortcuts() {
        return new Map(this._keyboardShortcuts);
    }

    async updateKeybinding(accelerators) {
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
    async testToggle() {
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

    dumpShortcuts() {
        console.log('[UIController] Registered shortcuts:');
        for (const [name, shortcut] of this._keyboardShortcuts) {
            console.log(`  ${name}: ${shortcut.accelerators.join(', ')} (ID: ${shortcut.actionId})`);
        }
    }
}
