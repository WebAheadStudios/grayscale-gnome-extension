/**
 * Panel Indicator Integration
 * Provides panel button with dynamic icon and popup menu
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Button } from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {
    PopupMenuItem,
    PopupSeparatorMenuItem,
    PopupSwitchMenuItem,
    PopupSubMenuMenuItem,
} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import type { PanelIndicator as IPanelIndicator, MenuItem } from './types/ui.js';
import type { ExtensionComponent } from './types/extension.js';

// Simple gettext placeholder
const _ = (str: string): string => str;

// Extension interface for panel indicator
interface Extension {
    uuid?: string;
    getComponent(name: string): any;
    getSettings(): any;
}

// Signal connection interface
interface SignalConnection {
    object: any;
    id: number;
}

/**
 * Grayscale Panel Button
 * Main panel button with dynamic icon and popup menu
 */
export class GrayscalePanelButton extends Button {
    private _extension: Extension;
    private _stateManager: any;
    private _effectManager: any;
    private _settings: any;
    private _monitorManager: any;
    private _signalIds: SignalConnection[];
    private _monitorMenuItems: Map<number, any>;
    public _icon: St.Icon;
    private _globalToggle: any; // PopupSwitchMenuItem
    private _statusItem: any; // PopupMenuItem
    private _monitorSubMenu: any; // PopupSubMenuMenuItem
    private _resetItem: any; // PopupMenuItem
    private _preferencesItem: any; // PopupMenuItem

    constructor(extension: Extension, position: string) {
        super(0.0, _('Grayscale Toggle'), false);

        this._extension = extension;
        this._stateManager = extension.getComponent('StateManager');
        this._effectManager = extension.getComponent('EffectManager');
        this._settings = extension.getSettings();
        this._monitorManager = extension.getComponent('MonitorManager');

        this._signalIds = [];
        this._monitorMenuItems = new Map();

        // Create panel icon
        this._createPanelIcon();

        // Build popup menu
        this._buildMenu();

        // Connect to state changes
        this._connectSignals();

        // Initial state sync
        this._updateIcon();
        this._updateMenu();

        // Add to panel
        this._addToPanel(position);
    }

    /**
     * Create the panel icon with dynamic state indication
     */
    private _createPanelIcon(): void {
        this._icon = new St.Icon({
            style_class: 'system-status-icon',
        });

        this.add_child(this._icon);
        this._updateIcon();
    }

    /**
     * Update icon based on current state
     */
    _updateIcon(): void {
        if (!this._stateManager) {
            this._icon.icon_name = 'display-brightness-symbolic';
            return;
        }

        try {
            const globalState = this._stateManager.getGrayscaleState();
            const monitors = this._stateManager.getAllMonitorStates() || {};
            const activeCount = Object.values(monitors).filter(state => state).length;
            const totalCount = Object.keys(monitors).length;

            if (globalState || activeCount > 0) {
                // Active state - use desaturated/grayscale icon
                this._icon.icon_name = 'applications-graphics-symbolic';
                this._icon.add_style_class_name('grayscale-active');
            } else {
                // Inactive state - use normal color icon
                this._icon.icon_name = 'display-brightness-symbolic';
                this._icon.remove_style_class_name('grayscale-active');
            }

            // Update tooltip
            if (activeCount === 0) {
                this.accessible_name = _('Grayscale: Disabled');
            } else if (activeCount === totalCount) {
                this.accessible_name = _('Grayscale: All monitors');
            } else {
                this.accessible_name = `${_('Grayscale')}: ${activeCount}/${totalCount} ${_('monitors')}`;
            }
        } catch (error) {
            console.error('[Grayscale] Error updating panel icon:', error);
            this._icon.icon_name = 'dialog-error-symbolic';
        }
    }

    /**
     * Build the popup menu with controls and status
     */
    private _buildMenu(): void {
        // Global toggle
        this._globalToggle = new PopupSwitchMenuItem(_('Enable Globally'), false);
        this._globalToggle.connect('toggled', this._onGlobalToggle.bind(this));
        (this.menu as any).addMenuItem(this._globalToggle);

        (this.menu as any).addMenuItem(new PopupSeparatorMenuItem());

        // Status section
        this._statusItem = new PopupMenuItem(_('Status: Inactive'), { reactive: false });
        (this._statusItem.actor as any).add_style_class_name('grayscale-status-item');
        (this.menu as any).addMenuItem(this._statusItem);

        (this.menu as any).addMenuItem(new PopupSeparatorMenuItem());

        // Monitor controls submenu
        this._monitorSubMenu = new PopupSubMenuMenuItem(_('Monitor Controls'));
        (this.menu as any).addMenuItem(this._monitorSubMenu);

        (this.menu as any).addMenuItem(new PopupSeparatorMenuItem());

        // Quick actions
        this._resetItem = new PopupMenuItem(_('Reset All'));
        this._resetItem.connect('activate', this._onResetAll.bind(this));
        (this.menu as any).addMenuItem(this._resetItem);

        // Preferences
        this._preferencesItem = new PopupMenuItem(_('Preferences'));
        this._preferencesItem.connect('activate', this._onOpenPreferences.bind(this));
        (this.menu as any).addMenuItem(this._preferencesItem);
    }

    /**
     * Update menu items based on current state
     */
    _updateMenu(): void {
        if (!this._stateManager) {
            this._globalToggle.setToggleState(false);
            this._statusItem.label.text = _('Status: Unavailable');
            return;
        }

        try {
            // Update global toggle
            const globalState = this._stateManager.getGrayscaleState();
            this._globalToggle.setToggleState(globalState);

            // Update status
            this._updateStatus();

            // Update monitor controls
            this._updateMonitorControls();
        } catch (error) {
            console.error('[Grayscale] Error updating menu:', error);
            this._statusItem.label.text = _('Status: Error');
        }
    }

    /**
     * Update status display
     */
    private _updateStatus(): void {
        if (!this._stateManager || !this._monitorManager) {
            this._statusItem.label.text = _('Status: Unavailable');
            return;
        }

        try {
            const monitors = this._stateManager.getAllMonitorStates() || {};
            const activeCount = Object.values(monitors).filter(state => state).length;
            const totalCount = Object.keys(monitors).length;

            let statusText: string;
            if (activeCount === 0) {
                statusText = _('Status: Disabled');
            } else if (activeCount === totalCount) {
                statusText = _('Status: All monitors active');
            } else {
                statusText = `${_('Status')}: ${activeCount}/${totalCount} ${_('monitors active')}`;
            }

            this._statusItem.label.text = statusText;
        } catch (error) {
            console.error('[Grayscale] Error updating status:', error);
            this._statusItem.label.text = _('Status: Error');
        }
    }

    /**
     * Update monitor controls submenu
     */
    private _updateMonitorControls(): void {
        if (!this._stateManager || !this._monitorManager) {
            return;
        }

        try {
            // Clear existing monitor items
            this._monitorSubMenu.menu.removeAll();
            this._monitorMenuItems.clear();

            const monitors = this._stateManager.getAllMonitorStates() || {};
            const monitorInfos = this._monitorManager.getAllMonitors() || [];

            // Add individual monitor controls
            for (const [index, monitorInfo] of monitorInfos.entries()) {
                const monitorId = (monitorInfo as any).index || index;
                const isActive = monitors[monitorId] || false;

                // Create monitor label with resolution info
                const geometry = (monitorInfo as any).geometry || { width: 0, height: 0 };
                const label = `${(monitorInfo as any).name || `Monitor ${index + 1}`} (${geometry.width}×${geometry.height})`;

                const monitorItem = new PopupSwitchMenuItem(label, isActive);
                (monitorItem as any)._monitorId = monitorId;

                monitorItem.connect('toggled', (item: any, state: boolean) => {
                    this._onMonitorToggle(item._monitorId, state);
                });

                this._monitorSubMenu.menu.addMenuItem(monitorItem);
                this._monitorMenuItems.set(monitorId, monitorItem);
            }

            // Add monitor detection info
            if (monitorInfos.length > 0) {
                this._monitorSubMenu.menu.addMenuItem(new PopupSeparatorMenuItem());

                const infoItem = new PopupMenuItem(
                    `${monitorInfos.length} ${_('monitors detected')}`,
                    {
                        reactive: false,
                    }
                );
                (infoItem.actor as any).add_style_class_name('grayscale-info-item');
                this._monitorSubMenu.menu.addMenuItem(infoItem);
            }
        } catch (error) {
            console.error('[Grayscale] Error updating monitor controls:', error);
        }
    }

    /**
     * Connect to state management signals
     */
    private _connectSignals(): void {
        if (this._stateManager) {
            const stateId = this._stateManager.connect('state-changed', () => {
                this._updateIcon();
                this._updateMenu();
            });
            this._signalIds.push({ object: this._stateManager, id: stateId });
        }

        if (this._monitorManager) {
            const monitorId = this._monitorManager.connect('monitors-changed', () => {
                this._updateMenu();
            });
            this._signalIds.push({ object: this._monitorManager, id: monitorId });
        }

        if (this._settings) {
            const settingsId = this._settings.connect('changed', () => {
                this._updateMenu();
            });
            this._signalIds.push({ object: this._settings, id: settingsId });
        }
    }

    /**
     * Handle global toggle
     */
    private _onGlobalToggle(item: any, state: boolean): void {
        if (!this._stateManager || !this._effectManager) {
            return;
        }

        try {
            this._stateManager.setGrayscaleState(state, { source: 'panel' });
        } catch (error) {
            console.error('[Grayscale] Error handling global toggle:', error);
        }
    }

    /**
     * Handle individual monitor toggle
     */
    private _onMonitorToggle(monitorId: number, state: boolean): void {
        if (!this._stateManager || !this._effectManager) {
            return;
        }

        try {
            this._stateManager.setMonitorState(monitorId, state, { source: 'panel' });
        } catch (error) {
            console.error('[Grayscale] Error handling monitor toggle:', error);
        }
    }

    /**
     * Handle reset all action
     */
    private _onResetAll(): void {
        if (!this._stateManager || !this._effectManager) {
            return;
        }

        try {
            this._stateManager.setGrayscaleState(false, { source: 'panel' });

            // Show notification
            this._showNotification(_('All grayscale effects have been disabled'));
        } catch (error) {
            console.error('[Grayscale] Error resetting all states:', error);
        }
    }

    /**
     * Handle open preferences
     */
    private _onOpenPreferences(): void {
        try {
            // Try to open extension preferences
            if (this._extension?.uuid) {
                (Main.extensionManager as any).openExtensionPrefs(this._extension.uuid);
            } else {
                this._showNotification(_('Preferences not available'));
            }
        } catch (error) {
            console.error('[Grayscale] Error opening preferences:', error);
            this._showNotification(_('Could not open preferences'));
        }
    }

    /**
     * Show notification to user
     */
    private _showNotification(message: string): void {
        try {
            (Main as any).notify(_('Grayscale Toggle'), message);
        } catch (error) {
            console.error('[Grayscale] Error showing notification:', error);
        }
    }

    /**
     * Add button to panel at specified position
     */
    private _addToPanel(position: string = 'right'): void {
        const panelPosition = position === 'left' ? 0 : -1;
        const panelBox =
            position === 'center'
                ? (Main.panel as any)._centerBox
                : position === 'left'
                  ? (Main.panel as any)._leftBox
                  : (Main.panel as any)._rightBox;

        panelBox.insert_child_at_index(this, panelPosition);
    }

    /**
     * Remove button from panel
     */
    private _removeFromPanel(): void {
        const parent = this.get_parent();
        if (parent) {
            parent.remove_child(this);
        }
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        // Remove from panel
        this._removeFromPanel();

        // Disconnect signals
        this._signalIds.forEach(({ object, id }) => {
            if (object && object.disconnect) {
                object.disconnect(id);
            }
        });
        this._signalIds = [];

        // Clear maps
        this._monitorMenuItems.clear();

        // Clear references
        this._extension = null as any;
        this._stateManager = null;
        this._effectManager = null;
        this._settings = null;
        this._monitorManager = null;

        super.destroy();
    }
}

/**
 * Panel Indicator Integration Manager
 * Manages the lifecycle of panel indicator components
 */
export class PanelIndicator implements IPanelIndicator, ExtensionComponent {
    private _extension: Extension;
    private _panelButton: GrayscalePanelButton | null = null;
    private _enabled: boolean;
    private _position: string;

    constructor(extension: Extension) {
        this._extension = extension;
        this._panelButton = null;
        this._enabled = false;
        this._position = 'right';
    }

    // IPanelIndicator implementation
    get actor(): any {
        return this._panelButton;
    }

    get icon(): any {
        return this._panelButton?._icon;
    }

    get menu(): any {
        return this._panelButton?.menu;
    }

    show(): void {
        if (this._panelButton) {
            this._panelButton.visible = true;
        }
    }

    hide(): void {
        if (this._panelButton) {
            this._panelButton.visible = false;
        }
    }

    updateIcon(iconName?: string): void {
        if (this._panelButton && this._panelButton._updateIcon) {
            this._panelButton._updateIcon();
        }
    }

    updateTooltip(text: string): void {
        if (this._panelButton) {
            this._panelButton.accessible_name = text;
        }
    }

    // ExtensionComponent implementation
    enable(): void {
        if (this._enabled) {
            console.warn('[Grayscale] Panel indicator already enabled');
            return;
        }

        try {
            // Get position preference from settings
            if (this._extension.getSettings) {
                const settings = this._extension.getSettings();
                this._position = settings.get_string('panel-position') || 'right';
            }

            // Create panel button
            this._panelButton = new GrayscalePanelButton(this._extension, this._position);

            console.log('[Grayscale] Panel indicator enabled');
            this._enabled = true;
        } catch (error) {
            console.error('[Grayscale] Error enabling panel indicator:', error);
        }
    }

    disable(): void {
        if (!this._enabled) {
            return;
        }

        try {
            if (this._panelButton) {
                this._panelButton.destroy();
                this._panelButton = null;
            }

            console.log('[Grayscale] Panel indicator disabled');
            this._enabled = false;
        } catch (error) {
            console.error('[Grayscale] Error disabling panel indicator:', error);
        }
    }

    destroy(): void {
        this.disable();
    }

    /**
     * Update panel position
     */
    updatePosition(newPosition: string): void {
        if (this._position === newPosition || !this._enabled) {
            return;
        }

        this._position = newPosition;

        // Recreate panel button with new position
        if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = new GrayscalePanelButton(this._extension, this._position);
        }
    }

    /**
     * Update status based on current state
     */
    updateStatus(active: boolean): void {
        if (this._panelButton && this._panelButton._updateIcon && this._panelButton._updateMenu) {
            this._panelButton._updateIcon();
            this._panelButton._updateMenu();
        }
    }

    /**
     * Check if indicator is enabled
     */
    get isEnabled(): boolean {
        return this._enabled;
    }

    /**
     * Get the current panel button instance
     */
    get panelButton(): GrayscalePanelButton | null {
        return this._panelButton;
    }

    /**
     * Get current panel position
     */
    get position(): string {
        return this._position;
    }
}
