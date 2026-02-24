/**
 * Quick Settings Integration for GNOME Shell 46+
 * Provides modern Quick Settings toggle for grayscale mode
 */

import {QuickToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {QuickSettingsMenu} from 'resource:///org/gnome/shell/ui/panel.js';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

const _ = (str) => str; // Simple gettext placeholder

/**
 * Grayscale Quick Toggle
 * Modern toggle following GNOME Shell 46+ patterns
 */
const GrayscaleQuickToggle = GObject.registerClass(
class GrayscaleQuickToggle extends QuickToggle {
    _init(extensionObject) {
        super._init({
            title: _('Grayscale'),
            iconName: 'applications-graphics-symbolic',
            toggleMode: true,
        });

        this._extensionObject = extensionObject;
        this._stateManager = null;
        this._effectManager = null;
        this._settings = null;
        this._signalIds = [];

        // Connect the toggle activation
        this.connect('clicked', this._onToggleClicked.bind(this));
        
        // Initialize state synchronization
        this._connectToExtension();
    }

    /**
     * Connect to extension components
     */
    _connectToExtension() {
        if (!this._extensionObject) {
            console.warn('[Grayscale] Extension object not available for Quick Settings');
            return;
        }

        this._stateManager = this._extensionObject.stateManager;
        this._effectManager = this._extensionObject.effectManager;
        this._settings = this._extensionObject.settings;

        if (this._stateManager) {
            const signalId = this._stateManager.connect('state-changed', 
                this._onExtensionStateChanged.bind(this));
            this._signalIds.push({object: this._stateManager, id: signalId});
        }

        if (this._settings) {
            const signalId = this._settings.connect('changed::global-enabled',
                this._onGlobalSettingsChanged.bind(this));
            this._signalIds.push({object: this._settings, id: signalId});
        }

        // Initial state sync
        this._syncState();
    }

    /**
     * Handle toggle click
     */
    _onToggleClicked() {
        if (!this._stateManager || !this._effectManager) {
            console.warn('[Grayscale] Extension components not available');
            return;
        }

        try {
            const currentState = this._stateManager.getGlobalState();
            
            if (currentState) {
                // Disable globally
                this._effectManager.disableGlobal();
                this._stateManager.setGlobalState(false);
            } else {
                // Enable globally
                this._effectManager.enableGlobal();
                this._stateManager.setGlobalState(true);
            }

            // Update UI state
            this._syncState();
            
        } catch (error) {
            console.error('[Grayscale] Error handling Quick Settings toggle:', error);
        }
    }

    /**
     * Handle extension state changes
     */
    _onExtensionStateChanged() {
        this._syncState();
    }

    /**
     * Handle global settings changes
     */
    _onGlobalSettingsChanged() {
        this._syncState();
    }

    /**
     * Synchronize toggle state with extension state
     */
    _syncState() {
        if (!this._stateManager) {
            this.checked = false;
            this.reactive = false;
            return;
        }

        try {
            const globalState = this._stateManager.getGlobalState();
            const isEnabled = this._settings?.get_boolean('global-enabled') ?? true;
            
            // Update toggle state
            this.checked = globalState;
            this.reactive = isEnabled;
            
            // Update subtitle with current status
            this._updateSubtitle();
            
        } catch (error) {
            console.error('[Grayscale] Error syncing Quick Settings state:', error);
            this.checked = false;
            this.reactive = false;
        }
    }

    /**
     * Update subtitle with current status information
     */
    _updateSubtitle() {
        if (!this._stateManager) {
            this.subtitle = _('Unavailable');
            return;
        }

        try {
            const monitors = this._stateManager.getMonitorStates();
            const activeCount = Object.values(monitors).filter(state => state).length;
            const totalCount = Object.keys(monitors).length;

            if (activeCount === 0) {
                this.subtitle = _('Disabled');
            } else if (activeCount === totalCount) {
                this.subtitle = _('All monitors');
            } else {
                this.subtitle = `${activeCount}/${totalCount} monitors`;
            }
        } catch (error) {
            console.error('[Grayscale] Error updating subtitle:', error);
            this.subtitle = this.checked ? _('Active') : _('Inactive');
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Disconnect all signals
        this._signalIds.forEach(({object, id}) => {
            if (object && object.disconnect) {
                object.disconnect(id);
            }
        });
        this._signalIds = [];

        // Clear references
        this._extensionObject = null;
        this._stateManager = null;
        this._effectManager = null;
        this._settings = null;

        super.destroy();
    }
});

/**
 * Grayscale System Indicator
 * Integrates the toggle into the Quick Settings panel
 */
const GrayscaleIndicator = GObject.registerClass(
class GrayscaleIndicator extends SystemIndicator {
    _init(extensionObject) {
        super._init();

        this._extensionObject = extensionObject;
        
        // Create and add the quick toggle
        this._indicator = this._addIndicator();
        this._indicator.iconName = 'applications-graphics-symbolic';
        
        this.quickSettingsItems.push(new GrayscaleQuickToggle(extensionObject));

        // Connect to state changes for indicator visibility
        this._connectStateSignals();
        this._updateIndicatorVisibility();
    }

    /**
     * Connect to state management signals
     */
    _connectStateSignals() {
        if (this._extensionObject?.stateManager) {
            this._stateSignalId = this._extensionObject.stateManager.connect(
                'state-changed', 
                this._updateIndicatorVisibility.bind(this)
            );
        }
    }

    /**
     * Update indicator visibility based on state
     */
    _updateIndicatorVisibility() {
        if (!this._extensionObject?.stateManager) {
            this._indicator.visible = false;
            return;
        }

        try {
            const globalState = this._extensionObject.stateManager.getGlobalState();
            this._indicator.visible = globalState;
        } catch (error) {
            console.error('[Grayscale] Error updating indicator visibility:', error);
            this._indicator.visible = false;
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Disconnect signals
        if (this._stateSignalId && this._extensionObject?.stateManager) {
            this._extensionObject.stateManager.disconnect(this._stateSignalId);
            this._stateSignalId = null;
        }

        // Destroy quick settings items
        this.quickSettingsItems.forEach(item => {
            if (item.destroy) {
                item.destroy();
            }
        });
        this.quickSettingsItems = [];

        // Clear references
        this._extensionObject = null;

        super.destroy();
    }
});

/**
 * Quick Settings Integration Manager
 * Manages the lifecycle of Quick Settings components
 */
export class QuickSettingsIntegration {
    constructor(extensionObject) {
        this._extensionObject = extensionObject;
        this._indicator = null;
        this._enabled = false;
    }

    /**
     * Enable Quick Settings integration
     */
    enable() {
        if (this._enabled) {
            console.warn('[Grayscale] Quick Settings already enabled');
            return;
        }

        try {
            // Check if Quick Settings is available (GNOME Shell 46+)
            if (!QuickSettingsMenu || !SystemIndicator) {
                console.warn('[Grayscale] Quick Settings not available in this GNOME Shell version');
                return;
            }

            // Create and add indicator
            this._indicator = new GrayscaleIndicator(this._extensionObject);
            
            // Add to Quick Settings panel
            const quickSettingsMenu = QuickSettingsMenu.getInstance();
            if (quickSettingsMenu) {
                quickSettingsMenu._indicators.add_child(this._indicator);
                quickSettingsMenu._addItems(this._indicator.quickSettingsItems);
                
                console.log('[Grayscale] Quick Settings integration enabled');
                this._enabled = true;
            } else {
                console.warn('[Grayscale] Could not access Quick Settings menu');
            }

        } catch (error) {
            console.error('[Grayscale] Error enabling Quick Settings integration:', error);
        }
    }

    /**
     * Disable Quick Settings integration
     */
    disable() {
        if (!this._enabled) {
            return;
        }

        try {
            if (this._indicator) {
                // Remove from Quick Settings panel
                const quickSettingsMenu = QuickSettingsMenu.getInstance();
                if (quickSettingsMenu) {
                    quickSettingsMenu._indicators.remove_child(this._indicator);
                    quickSettingsMenu._removeItems(this._indicator.quickSettingsItems);
                }

                // Destroy indicator
                this._indicator.destroy();
                this._indicator = null;
            }

            console.log('[Grayscale] Quick Settings integration disabled');
            this._enabled = false;

        } catch (error) {
            console.error('[Grayscale] Error disabling Quick Settings integration:', error);
        }
    }

    /**
     * Check if integration is enabled
     */
    get isEnabled() {
        return this._enabled;
    }

    /**
     * Get the current indicator instance
     */
    get indicator() {
        return this._indicator;
    }
}