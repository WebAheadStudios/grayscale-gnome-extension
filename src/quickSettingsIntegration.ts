/**
 * Quick Settings Integration for GNOME Shell 46+
 * Provides modern Quick Settings toggle for grayscale mode
 */

import GObject from 'gi://GObject';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import { QuickToggle, SystemIndicator } from 'resource:///org/gnome/shell/ui/quickSettings.js';

import type { ExtensionComponent } from './types/extension.js';
import type { QuickSettingsToggle } from './types/ui.js';

// Simple gettext placeholder
const _ = (str: string): string => str;

// Extension interface for Quick Settings
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
 * Grayscale Quick Toggle
 * Modern toggle following GNOME Shell 46+ patterns
 */
export const GrayscaleQuickToggle = GObject.registerClass(
    { GTypeName: 'GrayscaleQuickToggle' },
    class GrayscaleQuickToggle extends QuickToggle implements QuickSettingsToggle {
        private _extension: Extension;
        private _stateManager: any = null;
        private _effectManager: any = null;
        private _settings: any = null;
        private _signalIds: SignalConnection[];

        constructor(extension: Extension) {
            super({
                title: _('Grayscale'),
                iconName: 'applications-graphics-symbolic',
                toggleMode: true,
            });

            this._extension = extension;
            this._stateManager = null;
            this._effectManager = null;
            this._settings = null;
            this._signalIds = [];

            // Connect the toggle activation
            this.connect('clicked', this._onToggleClicked.bind(this));

            // Initialize state synchronization
            this._connectToExtension();
        }

        // QuickSettingsToggle interface implementation
        get actor(): any {
            return this;
        }

        override get label(): string {
            return this.title || '';
        }

        override get iconName(): string {
            return (this as any).icon_name || '';
        }

        toggle(): void {
            this._onToggleClicked();
        }

        setChecked(checked: boolean): void {
            (this as any).checked = checked;
        }

        setLabel(label: string): void {
            this.title = label;
        }

        setIcon(iconName: string): void {
            (this as any).iconName = iconName;
        }

        /**
         * Connect to extension components
         */
        private _connectToExtension(): void {
            if (!this._extension) {
                console.warn('[Grayscale] Extension object not available for Quick Settings');
                return;
            }

            this._stateManager = this._extension.getComponent('StateManager');
            this._effectManager = this._extension.getComponent('EffectManager');
            this._settings = this._extension.getSettings();

            if (this._stateManager) {
                const signalId = this._stateManager.connect(
                    'state-changed',
                    this._onExtensionStateChanged.bind(this)
                );
                this._signalIds.push({ object: this._stateManager, id: signalId });
            }

            if (this._settings) {
                const signalId = this._settings.connect(
                    'changed::global-enabled',
                    this._onGlobalSettingsChanged.bind(this)
                );
                this._signalIds.push({ object: this._settings, id: signalId });
            }

            // Initial state sync
            this._syncState();
        }

        /**
         * Handle toggle click
         */
        private _onToggleClicked(): void {
            if (!this._stateManager || !this._effectManager) {
                console.warn('[Grayscale] Extension components not available');
                return;
            }

            try {
                const currentState = this._stateManager.getGrayscaleState();

                // Toggle state
                this._stateManager.setGrayscaleState(!currentState, { source: 'quick-settings' });

                // Update UI state
                this._syncState();
            } catch (error) {
                console.error('[Grayscale] Error handling Quick Settings toggle:', error);
            }
        }

        /**
         * Handle extension state changes
         */
        private _onExtensionStateChanged(): void {
            this._syncState();
        }

        /**
         * Handle global settings changes
         */
        private _onGlobalSettingsChanged(): void {
            this._syncState();
        }

        /**
         * Synchronize toggle state with extension state
         */
        private _syncState(): void {
            if (!this._stateManager) {
                (this as any).checked = false;
                (this as any).reactive = false;
                return;
            }

            try {
                const globalState = this._stateManager.getGrayscaleState();
                const isEnabled = this._settings?.get_boolean('global-enabled') ?? true;

                // Update toggle state
                (this as any).checked = globalState;
                (this as any).reactive = isEnabled;

                // Update subtitle with current status
                this._updateSubtitle();
            } catch (error) {
                console.error('[Grayscale] Error syncing Quick Settings state:', error);
                (this as any).checked = false;
                (this as any).reactive = false;
            }
        }

        /**
         * Update subtitle with current status information
         */
        private _updateSubtitle(): void {
            if (!this._stateManager) {
                (this as any).subtitle = _('Unavailable');
                return;
            }

            try {
                const monitors = this._stateManager.getAllMonitorStates() || {};
                const activeCount = Object.values(monitors).filter(state => state).length;
                const totalCount = Object.keys(monitors).length;

                if (activeCount === 0) {
                    (this as any).subtitle = _('Disabled');
                } else if (activeCount === totalCount) {
                    (this as any).subtitle = _('All monitors');
                } else {
                    (this as any).subtitle = `${activeCount}/${totalCount} monitors`;
                }
            } catch (error) {
                console.error('[Grayscale] Error updating subtitle:', error);
                (this as any).subtitle = (this as any).checked ? _('Active') : _('Inactive');
            }
        }

        /**
         * Cleanup resources
         */
        override destroy(): void {
            // Disconnect all signals
            this._signalIds.forEach(({ object, id }) => {
                if (object && object.disconnect) {
                    object.disconnect(id);
                }
            });
            this._signalIds = [];

            // Clear references
            this._extension = null as any;
            this._stateManager = null;
            this._effectManager = null;
            this._settings = null;

            super.destroy();
        }
    }
);

/**
 * Grayscale System Indicator
 * Integrates the toggle into the Quick Settings panel
 */
export const GrayscaleIndicator = GObject.registerClass(
    { GTypeName: 'GrayscaleSystemIndicator' },
    class GrayscaleIndicator extends SystemIndicator {
        private _extension: Extension;
        private _stateSignalId: number | null = null;
        private _indicator: any;

        constructor(extension: Extension) {
            super();

            this._extension = extension;

            // Initialize the inherited quickSettingsItems array
            this.quickSettingsItems = [];

            // Create and add the quick toggle
            this._indicator = this._addIndicator();
            this._indicator.iconName = 'applications-graphics-symbolic';

            this.quickSettingsItems.push(new GrayscaleQuickToggle(extension));

            // Connect to state changes for indicator visibility
            this._connectStateSignals();
            this._updateIndicatorVisibility();
        }

        /**
         * Connect to state management signals
         */
        private _connectStateSignals(): void {
            const stateManager = this._extension?.getComponent('StateManager');
            if (stateManager) {
                this._stateSignalId = stateManager.connect(
                    'state-changed',
                    this._updateIndicatorVisibility.bind(this)
                );
            }
        }

        /**
         * Update indicator visibility based on state
         */
        private _updateIndicatorVisibility(): void {
            const stateManager = this._extension?.getComponent('StateManager');
            if (!stateManager) {
                this._indicator.visible = false;
                return;
            }

            try {
                const globalState = stateManager.getGrayscaleState();
                this._indicator.visible = globalState;
            } catch (error) {
                console.error('[Grayscale] Error updating indicator visibility:', error);
                this._indicator.visible = false;
            }
        }

        /**
         * Cleanup resources
         */
        override destroy(): void {
            // Disconnect signals
            if (this._stateSignalId) {
                const stateManager = this._extension?.getComponent('StateManager');
                if (stateManager) {
                    stateManager.disconnect(this._stateSignalId);
                    this._stateSignalId = null;
                }
            }

            // Destroy quick settings items
            this.quickSettingsItems.forEach(item => {
                if (item.destroy) {
                    item.destroy();
                }
            });
            this.quickSettingsItems = [];

            // Clear references
            this._extension = null as any;

            super.destroy();
        }
    }
);

/**
 * Quick Settings Integration Manager
 * Manages the lifecycle of Quick Settings components
 */
export class QuickSettingsIntegration implements ExtensionComponent {
    private _extension: Extension;
    private _indicator: InstanceType<typeof GrayscaleIndicator> | null = null;
    private _enabled: boolean;

    constructor(extension: Extension) {
        this._extension = extension;
        this._indicator = null;
        this._enabled = false;
    }

    /**
     * Enable Quick Settings integration
     */
    enable(): void {
        if (this._enabled) {
            console.warn('[Grayscale] Quick Settings already enabled');
            return;
        }

        try {
            // Check if Quick Settings is available (GNOME Shell 46+)
            if (!QuickSettings || !SystemIndicator) {
                console.warn(
                    '[Grayscale] Quick Settings not available in this GNOME Shell version'
                );
                return;
            }

            // Create and add indicator
            this._indicator = new GrayscaleIndicator(this._extension);

            // Add to Quick Settings panel
            const panel = (QuickSettings as any)._panel;
            if (panel && panel._indicators) {
                panel._indicators.add_child(this._indicator);
                panel._addItems(this._indicator.quickSettingsItems);

                console.log('[Grayscale] Quick Settings integration enabled');
                this._enabled = true;
            } else {
                console.warn('[Grayscale] Could not access Quick Settings panel');
            }
        } catch (error) {
            console.error('[Grayscale] Error enabling Quick Settings integration:', error);
        }
    }

    /**
     * Disable Quick Settings integration
     */
    disable(): void {
        if (!this._enabled) {
            return;
        }

        try {
            if (this._indicator) {
                // Remove from Quick Settings panel
                const panel = (QuickSettings as any)._panel;
                if (panel && panel._indicators) {
                    panel._indicators.remove_child(this._indicator);
                    panel._removeItems(this._indicator.quickSettingsItems);
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

    destroy(): void {
        this.disable();
    }

    /**
     * Update toggle state programmatically
     */
    updateToggleState(active: boolean): void {
        if (this._indicator && this._indicator.quickSettingsItems.length > 0) {
            const toggle = this._indicator.quickSettingsItems[0];
            if (toggle) {
                (toggle as any).checked = active;
            }
        }
    }

    /**
     * Check if integration is enabled
     */
    get isEnabled(): boolean {
        return this._enabled;
    }

    /**
     * Get the current indicator instance
     */
    get indicator(): InstanceType<typeof GrayscaleIndicator> | null {
        return this._indicator;
    }
}
