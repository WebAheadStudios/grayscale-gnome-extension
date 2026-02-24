/**
 * Core extension type definitions
 */

// Extension metadata interface
export interface GrayscaleExtensionMetadata {
    name: string;
    uuid: string;
    description: string;
    version: string;
    url?: string;
    'shell-version': string[];
    'gettext-domain'?: string;
    path: string;
    dir: any; // Gio.File
}

// Extension component lifecycle interface
export interface ExtensionComponent {
    enable(): void;
    disable(): void;
    destroy?(): void;
}

// Extension manager interface for component coordination
export interface ExtensionManager {
    readonly components: Map<string, ExtensionComponent>;
    addComponent(name: string, component: ExtensionComponent): void;
    removeComponent(name: string): void;
    enableAll(): void;
    disableAll(): void;
}
