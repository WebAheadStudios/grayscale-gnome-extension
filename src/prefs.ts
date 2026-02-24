/**
 * Preferences Dialog for GNOME Shell Grayscale Toggle Extension
 * GTK-based preferences window with comprehensive configuration options
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import {
    ExtensionPreferences,
    gettext as _,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import type { PreferencesWindow } from './types/ui.js';

/**
 * Keyboard Shortcut Setting Widget
 */
export class KeyboardShortcutSetting extends Gtk.Box {
    private _settings: Gio.Settings | null = null;
    private _key: string | null = null;
    private _signalId: number | null = null;
    private _label: Gtk.Label;
    private _button: Gtk.Button;
    private _resetButton: Gtk.Button;

    constructor(params: any = {}) {
        super({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            ...params,
        });

        this._settings = null;
        this._key = null;

        // Create label
        this._label = new Gtk.Label({
            hexpand: true,
            halign: Gtk.Align.START,
        });
        this.append(this._label);

        // Create shortcut button
        this._button = new Gtk.Button({
            css_classes: ['flat'],
            halign: Gtk.Align.END,
        });
        this._button.connect('clicked', this._onButtonClicked.bind(this));
        this.append(this._button);

        // Reset button
        this._resetButton = new Gtk.Button({
            icon_name: 'edit-clear-symbolic',
            css_classes: ['flat'],
            tooltip_text: _('Reset to default'),
        });
        this._resetButton.connect('clicked', this._onResetClicked.bind(this));
        this.append(this._resetButton);
    }

    bind(settings: Gio.Settings, key: string, label: string): void {
        this._settings = settings;
        this._key = key;
        this._label.label = label;

        this._updateButton();

        this._signalId = this._settings.connect(`changed::${key}`, this._updateButton.bind(this));
    }

    private _updateButton(): void {
        if (!this._settings || !this._key) return;

        const accelerators = this._settings.get_strv(this._key);
        if (accelerators.length > 0 && accelerators[0]) {
            this._button.label = accelerators[0];
        } else {
            this._button.label = _('Disabled');
        }
    }

    private _onButtonClicked(): void {
        if (!this._settings || !this._key) return;

        const dialog = new ShortcutDialog(this.get_root() as Gtk.Window, this._settings, this._key);
        dialog.present();
    }

    private _onResetClicked(): void {
        if (!this._settings || !this._key) return;
        this._settings.reset(this._key);
    }

    destroy(): void {
        if (this._signalId && this._settings) {
            this._settings.disconnect(this._signalId);
        }
        // Note: Gtk.Box destroy is handled by GTK
    }
}

/**
 * Shortcut Capture Dialog
 */
export class ShortcutDialog extends Gtk.Dialog {
    private _settings: Gio.Settings;
    private _key: string;
    private _shortcutLabel: Gtk.Label;
    private _currentAccelerator: string | null = null;

    constructor(parent: Gtk.Window, settings: Gio.Settings, key: string) {
        super({
            title: _('Set Keyboard Shortcut'),
            modal: true,
            transient_for: parent,
        });

        this._settings = settings;
        this._key = key;

        this.set_default_size(400, 200);

        // Add buttons
        this.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        this.add_button(_('Set'), Gtk.ResponseType.OK);
        this.set_response_sensitive(Gtk.ResponseType.OK, false);

        // Create content
        const content = this.get_content_area();
        content.set_spacing(12);
        content.set_margin_top(12);
        content.set_margin_bottom(12);
        content.set_margin_start(12);
        content.set_margin_end(12);

        const label = new Gtk.Label({
            label: _('Press the desired key combination'),
            wrap: true,
        });
        content.append(label);

        this._shortcutLabel = new Gtk.Label({
            label: _('No shortcut set'),
            css_classes: ['accent'],
        });
        content.append(this._shortcutLabel);

        // Set up key capture
        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', this._onKeyPressed.bind(this));
        this.add_controller(controller);

        this.connect('response', this._onResponse.bind(this));

        this._currentAccelerator = null;
    }

    private _onKeyPressed(
        controller: Gtk.EventControllerKey,
        keyval: number,
        keycode: number,
        state: Gdk.ModifierType
    ): boolean {
        // Filter out individual modifier keys
        if (
            keyval === Gdk.KEY_Control_L ||
            keyval === Gdk.KEY_Control_R ||
            keyval === Gdk.KEY_Shift_L ||
            keyval === Gdk.KEY_Shift_R ||
            keyval === Gdk.KEY_Alt_L ||
            keyval === Gdk.KEY_Alt_R ||
            keyval === Gdk.KEY_Super_L ||
            keyval === Gdk.KEY_Super_R
        ) {
            return false;
        }

        const accelerator = Gtk.accelerator_name(keyval, state);
        this._currentAccelerator = accelerator;
        this._shortcutLabel.label = accelerator;
        this.set_response_sensitive(Gtk.ResponseType.OK, true);

        return true;
    }

    private _onResponse(dialog: Gtk.Dialog, response: number): void {
        if (response === Gtk.ResponseType.OK && this._currentAccelerator) {
            this._settings.set_strv(this._key, [this._currentAccelerator]);
        }
        this.destroy();
    }
}

/**
 * Monitor Configuration Row
 */
export class MonitorConfigRow extends Adw.ActionRow {
    private _monitorId: number;
    private _switch: Gtk.Switch;

    constructor(monitorInfo: any) {
        super({
            title: monitorInfo.displayName || `Monitor ${monitorInfo.index + 1}`,
            subtitle: `${monitorInfo.width}×${monitorInfo.height} ${monitorInfo.isPrimary ? '(Primary)' : ''}`,
        });

        this._monitorId = monitorInfo.id;

        // Add switch
        this._switch = new Gtk.Switch({
            valign: Gtk.Align.CENTER,
        });
        this.add_suffix(this._switch);
        this.set_activatable_widget(this._switch);
    }

    bindToSettings(settings: Gio.Settings, key: string): void {
        settings.bind(key, this._switch, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    get monitorId(): number {
        return this._monitorId;
    }

    get enabled(): boolean {
        return this._switch.active;
    }

    set enabled(value: boolean) {
        this._switch.active = value;
    }
}

/**
 * Main Preferences Widget
 */
export default class GrayscalePreferences
    extends ExtensionPreferences
    implements PreferencesWindow
{
    get window(): any {
        return null; // Will be set by GNOME Shell
    }

    show(): void {
        // Implemented by base class
    }

    hide(): void {
        // Implemented by base class
    }

    present(): void {
        // Implemented by base class
    }

    destroy(): void {
        // Implemented by base class
    }

    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        return new Promise<void>(resolve => {
            const settings = this.getSettings();

            window.set_default_size(800, 600);

            // General Settings Page
            const generalPage = this._createGeneralPage(settings);
            window.add(generalPage);

            // UI Settings Page
            const uiPage = this._createUIPage(settings);
            window.add(uiPage);

            // Monitor Settings Page
            const monitorPage = this._createMonitorPage(settings);
            window.add(monitorPage);

            // Advanced Settings Page
            const advancedPage = this._createAdvancedPage(settings);
            window.add(advancedPage);

            resolve();
        });
    }

    private _createGeneralPage(settings: Gio.Settings): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });

        // Main toggle group
        const mainGroup = new Adw.PreferencesGroup({
            title: _('Main Settings'),
        });
        page.add(mainGroup);

        // Global enable/disable
        const globalRow = new Adw.SwitchRow({
            title: _('Enable Globally'),
            subtitle: _('Apply grayscale effect to all monitors'),
        });
        settings.bind('global-enabled', globalRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        mainGroup.add(globalRow);

        // Keyboard shortcut group
        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('Keyboard Shortcuts'),
        });
        page.add(shortcutGroup);

        // Global toggle shortcut
        const shortcutRow = new Adw.ActionRow({
            title: _('Toggle Grayscale'),
            subtitle: _('Keyboard shortcut to toggle grayscale on/off'),
        });

        const shortcutWidget = new KeyboardShortcutSetting();
        shortcutWidget.bind(settings, 'toggle-keybinding', '');
        shortcutRow.add_suffix(shortcutWidget);
        shortcutRow.set_activatable_widget(shortcutWidget);
        shortcutGroup.add(shortcutRow);

        return page;
    }

    private _createUIPage(settings: Gio.Settings): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: _('Interface'),
            icon_name: 'applications-graphics-symbolic',
        });

        // Panel indicator group
        const panelGroup = new Adw.PreferencesGroup({
            title: _('Panel Indicator'),
        });
        page.add(panelGroup);

        // Show panel indicator
        const showPanelRow = new Adw.SwitchRow({
            title: _('Show Panel Indicator'),
            subtitle: _('Display an indicator in the top panel'),
        });
        settings.bind(
            'show-panel-indicator',
            showPanelRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        panelGroup.add(showPanelRow);

        // Panel position
        const positionRow = new Adw.ComboRow({
            title: _('Panel Position'),
            subtitle: _('Where to place the panel indicator'),
            model: new Gtk.StringList(),
        });
        (positionRow.model as Gtk.StringList).append(_('Left'));
        (positionRow.model as Gtk.StringList).append(_('Center'));
        (positionRow.model as Gtk.StringList).append(_('Right'));

        // Bind to settings
        const positionValue = settings.get_string('panel-position');
        positionRow.selected = ['left', 'center', 'right'].indexOf(positionValue);
        positionRow.connect('notify::selected', () => {
            const positions = ['left', 'center', 'right'];
            settings.set_string('panel-position', positions[positionRow.selected]);
        });
        panelGroup.add(positionRow);

        // Quick Settings group
        const quickSettingsGroup = new Adw.PreferencesGroup({
            title: _('Quick Settings'),
        });
        page.add(quickSettingsGroup);

        // Show Quick Settings toggle
        const showQuickRow = new Adw.SwitchRow({
            title: _('Show in Quick Settings'),
            subtitle: _('Add toggle to GNOME Quick Settings panel'),
        });
        settings.bind('show-quick-settings', showQuickRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        quickSettingsGroup.add(showQuickRow);

        // Notifications group
        const notificationGroup = new Adw.PreferencesGroup({
            title: _('Notifications'),
        });
        page.add(notificationGroup);

        // Show notifications
        const showNotificationsRow = new Adw.SwitchRow({
            title: _('Show Notifications'),
            subtitle: _('Display notifications when state changes'),
        });
        settings.bind(
            'show-notifications',
            showNotificationsRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        notificationGroup.add(showNotificationsRow);

        // Notification timeout
        const timeoutRow = new Adw.SpinRow({
            title: _('Notification Timeout'),
            subtitle: _('How long notifications stay visible (milliseconds)'),
        });
        timeoutRow.set_adjustment(
            new Gtk.Adjustment({
                lower: 1000,
                upper: 10000,
                step_increment: 500,
                page_increment: 1000,
            })
        );
        settings.bind('notification-timeout', timeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        notificationGroup.add(timeoutRow);

        return page;
    }

    private _createMonitorPage(settings: Gio.Settings): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: _('Monitors'),
            icon_name: 'display-symbolic',
        });

        // Monitor configuration group
        const monitorGroup = new Adw.PreferencesGroup({
            title: _('Monitor Configuration'),
            description: _('Configure grayscale settings for individual monitors'),
        });
        page.add(monitorGroup);

        // Note: In a real implementation, you would need to get monitor information
        // from the extension's monitor manager. For now, we'll create a placeholder.
        const placeholderRow = new Adw.ActionRow({
            title: _('Monitor Detection'),
            subtitle: _('Monitor configuration will be available when the extension is running'),
        });
        monitorGroup.add(placeholderRow);

        // Per-monitor mode group
        const perMonitorGroup = new Adw.PreferencesGroup({
            title: _('Per-Monitor Settings'),
        });
        page.add(perMonitorGroup);

        // Enable per-monitor mode
        const perMonitorRow = new Adw.SwitchRow({
            title: _('Per-Monitor Mode'),
            subtitle: _('Allow independent control of each monitor'),
        });
        settings.bind('per-monitor-mode', perMonitorRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        perMonitorGroup.add(perMonitorRow);

        // Auto-restore monitor states
        const autoRestoreRow = new Adw.SwitchRow({
            title: _('Auto-restore States'),
            subtitle: _('Remember and restore individual monitor states'),
        });
        settings.bind(
            'auto-restore-states',
            autoRestoreRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        perMonitorGroup.add(autoRestoreRow);

        return page;
    }

    private _createAdvancedPage(settings: Gio.Settings): Adw.PreferencesPage {
        const page = new Adw.PreferencesPage({
            title: _('Advanced'),
            icon_name: 'preferences-other-symbolic',
        });

        // Effect settings group
        const effectGroup = new Adw.PreferencesGroup({
            title: _('Effect Settings'),
        });
        page.add(effectGroup);

        // Animation duration
        const animationRow = new Adw.SpinRow({
            title: _('Animation Duration'),
            subtitle: _('Duration of grayscale transition animations (milliseconds)'),
        });
        animationRow.set_adjustment(
            new Gtk.Adjustment({
                lower: 0,
                upper: 2000,
                step_increment: 50,
                page_increment: 200,
            })
        );
        settings.bind('animation-duration', animationRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        effectGroup.add(animationRow);

        // Effect intensity
        const intensityRow = new Adw.SpinRow({
            title: _('Grayscale Intensity'),
            subtitle: _('Intensity of the grayscale effect (0.0 - 1.0)'),
            digits: 1,
        });
        intensityRow.set_adjustment(
            new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.1,
                page_increment: 0.1,
            })
        );
        settings.bind('grayscale-intensity', intensityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        effectGroup.add(intensityRow);

        // Startup behavior group
        const startupGroup = new Adw.PreferencesGroup({
            title: _('Startup Behavior'),
        });
        page.add(startupGroup);

        // Remember last state
        const rememberRow = new Adw.SwitchRow({
            title: _('Remember Last State'),
            subtitle: _('Restore previous grayscale state on startup'),
        });
        settings.bind('remember-state', rememberRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        startupGroup.add(rememberRow);

        // Auto-enable on startup
        const autoEnableRow = new Adw.SwitchRow({
            title: _('Auto-enable on Startup'),
            subtitle: _('Automatically enable grayscale when extension starts'),
        });
        settings.bind(
            'auto-enable-startup',
            autoEnableRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        startupGroup.add(autoEnableRow);

        // Debug group
        const debugGroup = new Adw.PreferencesGroup({
            title: _('Debug'),
        });
        page.add(debugGroup);

        // Enable debug logging
        const debugRow = new Adw.SwitchRow({
            title: _('Enable Debug Logging'),
            subtitle: _('Output detailed debugging information to system logs'),
        });
        settings.bind('debug-logging', debugRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        debugGroup.add(debugRow);

        // Reset settings button
        const resetRow = new Adw.ActionRow({
            title: _('Reset All Settings'),
            subtitle: _('Restore all settings to their default values'),
        });

        const resetButton = new Gtk.Button({
            label: _('Reset'),
            css_classes: ['destructive-action'],
            valign: Gtk.Align.CENTER,
        });
        resetButton.connect('clicked', () => {
            this._showResetDialog(resetButton.get_root() as Gtk.Window, settings);
        });
        resetRow.add_suffix(resetButton);
        resetRow.set_activatable_widget(resetButton);
        debugGroup.add(resetRow);

        return page;
    }

    private _showResetDialog(parent: Gtk.Window, settings: Gio.Settings): void {
        const dialog = new Adw.MessageDialog({
            transient_for: parent,
            heading: _('Reset All Settings?'),
            body: _(
                'This will restore all settings to their default values. This action cannot be undone.'
            ),
        });

        dialog.add_response('cancel', _('Cancel'));
        dialog.add_response('reset', _('Reset'));
        dialog.set_response_appearance('reset', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.set_default_response('cancel');

        dialog.connect('response', (dialog: Adw.MessageDialog, response: string) => {
            if (response === 'reset') {
                // Reset all settings to defaults
                const keys = settings.list_keys();
                keys.forEach(key => {
                    settings.reset(key);
                });
            }
            dialog.destroy();
        });

        dialog.present();
    }
}
