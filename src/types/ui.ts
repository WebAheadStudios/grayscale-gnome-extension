/**
 * UI component and interface type definitions
 */

// Panel indicator interface
export interface PanelIndicator {
    readonly actor: any; // St.Button - will be typed properly after GNOME types verification
    readonly icon: any; // St.Icon
    readonly menu: any; // PopupMenu.PopupMenu
    show(): void;
    hide(): void;
    updateIcon(iconName?: string): void;
    updateTooltip(text: string): void;
    destroy(): void;
}

// Quick Settings integration interface
export interface QuickSettingsToggle {
    readonly actor: any; // QuickSettings.QuickToggle
    readonly label: string;
    readonly iconName: string;
    readonly checked: boolean;
    toggle(): void;
    setChecked(checked: boolean): void;
    setLabel(label: string): void;
    setIcon(iconName: string): void;
    destroy(): void;
}

// UI controller interface
export interface UIController {
    readonly panelIndicator?: PanelIndicator;
    readonly quickSettingsToggle?: QuickSettingsToggle;
    showIndicator(): void;
    hideIndicator(): void;
    enableQuickSettings(): void;
    disableQuickSettings(): void;
    updateStatus(active: boolean): void;
    destroy(): void;
}

// Menu item interface for panel indicator menu
export interface MenuItem {
    readonly actor: any; // PopupMenu.PopupMenuItem
    readonly label: string;
    activate(): void;
    setLabel(label: string): void;
    setSensitive(sensitive: boolean): void;
    destroy(): void;
}

// Preferences window interface
export interface PreferencesWindow {
    readonly window: any; // Adw.PreferencesWindow
    show(): void;
    hide(): void;
    present(): void;
    destroy(): void;
}
