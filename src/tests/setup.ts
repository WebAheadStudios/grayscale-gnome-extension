/**
 * Jest test setup file with GNOME Shell API mocks
 * This file sets up the testing environment for GNOME Shell extensions
 */

// Mock GObject and GLib types
global.GObject = {
    Object: class MockGObject {},
    signal_connect: jest.fn(),
    signal_disconnect: jest.fn(),
    signal_emit: jest.fn(),
    TYPE_STRING: 'string',
    TYPE_BOOLEAN: 'boolean',
    TYPE_INT: 'int',
    ParamFlags: {
        READABLE: 1,
        WRITABLE: 2,
        CONSTRUCT: 4,
    },
    registerClass: jest.fn((config, cls) => cls),
};

global.GLib = {
    PRIORITY_DEFAULT: 0,
    SOURCE_REMOVE: false,
    SOURCE_CONTINUE: true,
    timeout_add: jest.fn((priority, delay, callback) => {
        setTimeout(callback, delay);
        return 1; // Mock source id
    }),
    source_remove: jest.fn(),
    get_home_dir: jest.fn(() => '/home/test'),
    build_filenamev: jest.fn((...parts) => parts.join('/')),
};

// Mock GNOME Shell modules
global.imports = {
    gi: {
        GObject: global.GObject,
        GLib: global.GLib,
        Gio: {
            Settings: class MockSettings {
                connect = jest.fn();
                disconnect = jest.fn();
                get_boolean = jest.fn(() => false);
                set_boolean = jest.fn();
                get_string = jest.fn(() => '');
                set_string = jest.fn();
                get_strv = jest.fn(() => []);
                set_strv = jest.fn();
            },
            SettingsSchemaSource: {
                get_default: jest.fn(() => ({
                    lookup: jest.fn(() => ({ get_id: jest.fn(() => 'test-schema') })),
                })),
            },
        },
        Meta: {
            Display: {
                get_current: jest.fn(() => ({
                    get_n_monitors: jest.fn(() => 1),
                    get_monitor_geometry: jest.fn(() => ({
                        x: 0,
                        y: 0,
                        width: 1920,
                        height: 1080,
                    })),
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                })),
            },
            MonitorManager: {
                get: jest.fn(() => ({
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                    get_monitor_for_connector: jest.fn(),
                })),
            },
            WorkspaceManager: {
                get_default: jest.fn(() => ({
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                })),
            },
        },
        Shell: {
            Global: {
                get: jest.fn(() => ({
                    display: {
                        connect: jest.fn(),
                        disconnect: jest.fn(),
                        get_n_monitors: jest.fn(() => 1),
                    },
                    stage: {
                        connect: jest.fn(),
                        disconnect: jest.fn(),
                    },
                })),
            },
        },
        St: {
            BoxLayout: class MockBoxLayout {
                connect = jest.fn();
                disconnect = jest.fn();
                add_child = jest.fn();
                remove_child = jest.fn();
                destroy = jest.fn();
            },
            Button: class MockButton {
                connect = jest.fn();
                disconnect = jest.fn();
                set_child = jest.fn();
                destroy = jest.fn();
            },
            Icon: class MockIcon {
                connect = jest.fn();
                disconnect = jest.fn();
                set_icon_name = jest.fn();
                destroy = jest.fn();
            },
            Label: class MockLabel {
                connect = jest.fn();
                disconnect = jest.fn();
                set_text = jest.fn();
                destroy = jest.fn();
            },
        },
    },
    ui: {
        main: {
            panel: {
                statusArea: {
                    quickSettings: {
                        connect: jest.fn(),
                        disconnect: jest.fn(),
                        addExternalIndicator: jest.fn(),
                    },
                    aggregateMenu: {
                        connect: jest.fn(),
                        disconnect: jest.fn(),
                    },
                },
                _rightBox: {
                    insert_child_at_index: jest.fn(),
                    remove_child: jest.fn(),
                },
            },
            layoutManager: {
                connect: jest.fn(),
                disconnect: jest.fn(),
                monitors: [{ x: 0, y: 0, width: 1920, height: 1080, index: 0 }],
            },
            wm: {
                addKeybinding: jest.fn(),
                removeKeybinding: jest.fn(),
            },
            messageTray: {
                add: jest.fn(),
            },
        },
        panelMenu: {
            Button: class MockPanelButton {
                connect = jest.fn();
                disconnect = jest.fn();
                add_child = jest.fn();
                remove_child = jest.fn();
                destroy = jest.fn();
                menu = {
                    connect: jest.fn(),
                    disconnect: jest.fn(),
                    addMenuItem: jest.fn(),
                    removeAll: jest.fn(),
                };
            },
        },
        popupMenu: {
            PopupSwitchMenuItem: class MockPopupSwitchMenuItem {
                connect = jest.fn();
                disconnect = jest.fn();
                setToggleState = jest.fn();
                destroy = jest.fn();
            },
        },
        quickSettings: {
            QuickToggle: class MockQuickToggle {
                connect = jest.fn();
                disconnect = jest.fn();
                destroy = jest.fn();
            },
            SystemIndicator: class MockSystemIndicator {
                connect = jest.fn();
                disconnect = jest.fn();
                quickSettingsItems = [];
                destroy = jest.fn();
            },
        },
    },
    misc: {
        config: {
            PACKAGE_VERSION: '46.0',
        },
        extensionUtils: {
            getCurrentExtension: jest.fn(() => ({
                metadata: {
                    uuid: 'grayscale-toggle@luiz.dev',
                    name: 'Grayscale Toggle',
                    'shell-version': ['46'],
                },
                dir: {
                    get_child: jest.fn(() => ({
                        get_path: jest.fn(() => '/test/path'),
                    })),
                    get_path: jest.fn(() => '/test/extension/path'),
                },
                path: '/test/extension/path',
            })),
            getSettings: jest.fn(() => new global.imports.gi.Gio.Settings()),
        },
    },
};

// Mock console methods for cleaner test output
const originalConsole = { ...console };
global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Global test utilities
global.testUtils = {
    createMockExtension: () => ({
        uuid: 'test-extension@test.dev',
        metadata: {
            uuid: 'test-extension@test.dev',
            name: 'Test Extension',
            'shell-version': ['46'],
        },
        dir: {
            get_path: () => '/test/path',
        },
    }),

    createMockMonitor: (index = 0) => ({
        index,
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        connector: `DP-${index + 1}`,
    }),

    createMockSettings: (schema = 'test.schema') => new global.imports.gi.Gio.Settings(),

    mockSignalConnection: () => ({
        id: Math.random(),
        disconnect: jest.fn(),
    }),
};

// Clean up after each test
afterEach(() => {
    jest.clearAllMocks();
});

export {};
