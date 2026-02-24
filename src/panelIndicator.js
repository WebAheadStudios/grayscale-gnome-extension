/**
 * Panel Indicator Integration
 * Provides panel button with dynamic icon and popup menu
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {PopupMenuItem, PopupSeparatorMenuItem, PopupSwitchMenuItem, PopupSubMenuMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const _ = (str) => str; // Simple gettext placeholder

/**
 * Grayscale Panel Button
 * Main panel button with dynamic icon and popup menu
 */
const GrayscalePanelButton = GObject.registerClass(
class GrayscalePanelButton extends Button {
    _init(extensionObject, position) {
        super._init(0.0, _('Grayscale Toggle'), false);

        this._extensionObject = extensionObject;
        this._stateManager = extensionObject.stateManager;
        this._effectManager = extensionObject.effectManager;
        this._settings = extensionObject.settings;
        this._monitorManager = extensionObject.monitorManager;

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
    _createPanelIcon() {
        this._icon = new St.Icon({
            style_class: 'system-status-icon',
        });
        
        this.add_child(this._icon);
        this._updateIcon();
    }

    /**
     * Update icon based on current state
     */
    _updateIcon() {
        if (!this._stateManager) {
            this._icon.icon_name = 'display-brightness-symbolic';
            return;
        }

        try {
            const globalState = this._stateManager.getGlobalState();
            const monitors = this._stateManager.getMonitorStates();
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
    _buildMenu() {
        // Global toggle
        this._globalToggle = new PopupSwitchMenuItem(_('Enable Globally'), false);
        this._globalToggle.connect('toggled', this._onGlobalToggle.bind(this));
        this.menu.addMenuItem(this._globalToggle);

        this.menu.addMenuItem(new PopupSeparatorMenuItem());

        // Status section
        this._statusItem = new PopupMenuItem(_('Status: Inactive'), {reactive: false});
        this._statusItem.actor.add_style_class_name('grayscale-status-item');
        this.menu.addMenuItem(this._statusItem);

        this.menu.addMenuItem(new PopupSeparatorMenuItem());

        // Monitor controls submenu
        this._monitorSubMenu = new PopupSubMenuMenuItem(_('Monitor Controls'));
        this.menu.addMenuItem(this._monitorSubMenu);

        this.menu.addMenuItem(new PopupSeparatorMenuItem());

        // Quick actions
        this._resetItem = new PopupMenuItem(_('Reset All'));
        this._resetItem.connect('activate', this._onResetAll.bind(this));
        this.menu.addMenuItem(this._resetItem);

        // Preferences
        this._preferencesItem = new PopupMenuItem(_('Preferences'));
        this._preferencesItem.connect('activate', this._onOpenPreferences.bind(this));
        this.menu.addMenuItem(this._preferencesItem);
    }

    /**
     * Update menu items based on current state
     */
    _updateMenu() {
        if (!this._stateManager) {
            this._globalToggle.setToggleState(false);
            this._statusItem.label.text = _('Status: Unavailable');
            return;
        }

        try {
            // Update global toggle
            const globalState = this._stateManager.getGlobalState();
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
    _updateStatus() {
        if (!this._stateManager || !this._monitorManager) {
            this._statusItem.label.text = _('Status: Unavailable');
            return;
        }

        try {
            const monitors = this._stateManager.getMonitorStates();
            const monitorInfos = this._monitorManager.getMonitorInfos();
            const activeCount = Object.values(monitors).filter(state => state).length;
            const totalCount = Object.keys(monitors).length;

            let statusText;
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
    _updateMonitorControls() {
        if (!this._stateManager || !this._monitorManager) {
            return;
        }

        try {
            // Clear existing monitor items
            this._monitorSubMenu.menu.removeAll();
            this._monitorMenuItems.clear();

            const monitors = this._stateManager.getMonitorStates();
            const monitorInfos = this._monitorManager.getMonitorInfos();

            // Add individual monitor controls
            for (const [index, monitorInfo] of monitorInfos.entries()) {
                const monitorId = monitorInfo.id;
                const isActive = monitors[monitorId] || false;
                
                // Create monitor label with resolution info
                const label = `${monitorInfo.displayName || `Monitor ${index + 1}`} (${monitorInfo.width}×${monitorInfo.height})`;
                
                const monitorItem = new PopupSwitchMenuItem(label, isActive);
                monitorItem._monitorId = monitorId;
                
                monitorItem.connect('toggled', (item, state) => {
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
                    {reactive: false}
                );
                infoItem.actor.add_style_class_name('grayscale-info-item');
                this._monitorSubMenu.menu.addMenuItem(infoItem);
            }

        } catch (error) {
            console.error('[Grayscale] Error updating monitor controls:', error);
        }
    }

    /**
     * Connect to state management signals
     */
    _connectSignals() {
        if (this._stateManager) {
            const stateId = this._stateManager.connect('state-changed', () => {
                this._updateIcon();
                this._updateMenu();
            });
            this._signalIds.push({object: this._stateManager, id: stateId});
        }

        if (this._monitorManager) {
            const monitorId = this._monitorManager.connect('monitors-changed', () => {
                this._updateMenu();
            });
            this._signalIds.push({object: this._monitorManager, id: monitorId});
        }

        if (this._settings) {
            const settingsId = this._settings.connect('changed', () => {
                this._updateMenu();
            });
            this._signalIds.push({object: this._settings, id: settingsId});
        }
    }

    /**
     * Handle global toggle
     */
    _onGlobalToggle(item, state) {
        if (!this._stateManager || !this._effectManager) {
            return;
        }

        try {
            if (state) {
                this._effectManager.enableGlobal();
                this._stateManager.setGlobalState(true);
            } else {
                this._effectManager.disableGlobal();
                this._stateManager.setGlobalState(false);
            }
        } catch (error) {
            console.error('[Grayscale] Error handling global toggle:', error);
        }
    }

    /**
     * Handle individual monitor toggle
     */
    _onMonitorToggle(monitorId, state) {
        if (!this._stateManager || !this._effectManager) {
            return;
        }

        try {
            if (state) {
                this._effectManager.enableMonitor(monitorId);
                this._stateManager.setMonitorState(monitorId, true);
            } else {
                this._effectManager.disableMonitor(monitorId);
                this._stateManager.setMonitorState(monitorId, false);
            }
        } catch (error) {
            console.error('[Grayscale] Error handling monitor toggle:', error);
        }
    }

    /**
     * Handle reset all action
     */
    _onResetAll() {
        if (!this._stateManager || !this._effectManager) {
            return;
        }

        try {
            this._effectManager.disableGlobal();
            this._stateManager.resetAllStates();
            
            // Show notification
            this._showNotification(_('All grayscale effects have been disabled'));
            
        } catch (error) {
            console.error('[Grayscale] Error resetting all states:', error);
        }
    }

    /**
     * Handle open preferences
     */
    _onOpenPreferences() {
        try {
            // Try to open extension preferences
            if (this._extensionObject?.uuid) {
                Main.extensionManager.openExtensionPrefs(this._extensionObject.uuid);
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
    _showNotification(message) {
        try {
            Main.notify(_('Grayscale Toggle'), message);
        } catch (error) {
            console.error('[Grayscale] Error showing notification:', error);
        }
    }

    /**
     * Add button to panel at specified position
     */
    _addToPanel(position = 'right') {
        const panelPosition = position === 'left' ? 0 : -1;
        const panelBox = position === 'center' ? 
            Main.panel._centerBox : 
            (position === 'left' ? Main.panel._leftBox : Main.panel._rightBox);
        
        panelBox.insert_child_at_index(this, panelPosition);
    }

    /**
     * Remove button from panel
     */
    _removeFromPanel() {
        const parent = this.get_parent();
        if (parent) {
            parent.remove_child(this);
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Remove from panel
        this._removeFromPanel();

        // Disconnect signals
        this._signalIds.forEach(({object, id}) => {
            if (object && object.disconnect) {
                object.disconnect(id);
            }
        });
        this._signalIds = [];

        // Clear maps
        this._monitorMenuItems.clear();

        // Clear references
        this._extensionObject = null;
        this._stateManager = null;
        this._effectManager = null;
        this._settings = null;
        this._monitorManager = null;

        super.destroy();
    }
});

/**
 * Panel Indicator Integration Manager
 * Manages the lifecycle of panel indicator components
 */
export class PanelIndicator {
    constructor(extensionObject) {
        this._extensionObject = extensionObject;
        this._panelButton = null;
        this._enabled = false;
        this._position = 'right';
    }

    /**
     * Enable panel indicator
     */
    enable() {
        if (this._enabled) {
            console.warn('[Grayscale] Panel indicator already enabled');
            return;
        }

        try {
            // Get position preference from settings
            if (this._extensionObject.settings) {
                this._position = this._extensionObject.settings.get_string('panel-position') || 'right';
            }

            // Create panel button
            this._panelButton = new GrayscalePanelButton(this._extensionObject, this._position);
            
            console.log('[Grayscale] Panel indicator enabled');
            this._enabled = true;

        } catch (error) {
            console.error('[Grayscale] Error enabling panel indicator:', error);
        }
    }

    /**
     * Disable panel indicator
     */
    disable() {
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

    /**
     * Update panel position
     */
    updatePosition(newPosition) {
        if (this._position === newPosition || !this._enabled) {
            return;
        }

        this._position = newPosition;
        
        // Recreate panel button with new position
        if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = new GrayscalePanelButton(this._extensionObject, this._position);
        }
    }

    /**
     * Check if indicator is enabled
     */
    get isEnabled() {
        return this._enabled;
    }

    /**
     * Get the current panel button instance
     */
    get panelButton() {
        return this._panelButton;
    }

    /**
     * Get current panel position
     */
    get position() {
        return this._position;
    }
}