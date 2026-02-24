/**
 * Infrastructure Components Unit Tests
 * Tests for BaseComponent, ComponentRegistry, SignalManager, and other infrastructure
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { ExtensionComponent, ComponentState, ComponentConfig } from '../types/infrastructure';

// Import components to test
import { BaseComponent } from '../infrastructure/BaseComponent';
import { ComponentRegistry } from '../infrastructure/ComponentRegistry';
import { SignalManager } from '../infrastructure/SignalManager';
import { Logger } from '../infrastructure/Logger';

describe('Infrastructure Components', () => {
    describe('BaseComponent', () => {
        let component: BaseComponent;
        let mockConfig: ComponentConfig;

        beforeEach(() => {
            mockConfig = {
                name: 'TestComponent',
                version: '1.0.0',
                dependencies: [],
                settings: {},
            };
            component = new BaseComponent(mockConfig);
        });

        afterEach(() => {
            if (component.getState() === 'active') {
                component.disable();
            }
        });

        it('should initialize with correct default state', () => {
            expect(component.getState()).toBe('inactive');
            expect(component.getName()).toBe('TestComponent');
            expect(component.getVersion()).toBe('1.0.0');
        });

        it('should enable component successfully', async () => {
            const result = await component.enable();
            expect(result).toBe(true);
            expect(component.getState()).toBe('active');
        });

        it('should disable component successfully', async () => {
            await component.enable();
            const result = await component.disable();
            expect(result).toBe(true);
            expect(component.getState()).toBe('inactive');
        });

        it('should handle enable errors gracefully', async () => {
            // Mock an enable error
            const originalEnable = component['onEnable'];
            component['onEnable'] = jest.fn().mockRejectedValue(new Error('Enable failed'));

            const result = await component.enable();
            expect(result).toBe(false);
            expect(component.getState()).toBe('error');

            // Restore original method
            component['onEnable'] = originalEnable;
        });

        it('should handle disable errors gracefully', async () => {
            await component.enable();

            // Mock a disable error
            const originalDisable = component['onDisable'];
            component['onDisable'] = jest.fn().mockRejectedValue(new Error('Disable failed'));

            const result = await component.disable();
            expect(result).toBe(false);
            expect(component.getState()).toBe('error');

            // Restore original method
            component['onDisable'] = originalDisable;
        });

        it('should emit state change signals', async () => {
            const stateChangeSpy = jest.fn();
            component.connect('state-changed', stateChangeSpy);

            await component.enable();
            expect(stateChangeSpy).toHaveBeenCalledWith('active', 'inactive');

            await component.disable();
            expect(stateChangeSpy).toHaveBeenCalledWith('inactive', 'active');
        });

        it('should validate configuration', () => {
            const invalidConfig = {
                name: '', // Invalid: empty name
                version: '1.0.0',
                dependencies: [],
                settings: {},
            };

            expect(() => new BaseComponent(invalidConfig as ComponentConfig)).toThrow();
        });
    });

    describe('ComponentRegistry', () => {
        let registry: ComponentRegistry;
        let mockComponent1: BaseComponent;
        let mockComponent2: BaseComponent;

        beforeEach(() => {
            registry = ComponentRegistry.getInstance();
            registry.clear(); // Clear any existing components

            mockComponent1 = new BaseComponent({
                name: 'Component1',
                version: '1.0.0',
                dependencies: [],
                settings: {},
            });

            mockComponent2 = new BaseComponent({
                name: 'Component2',
                version: '1.0.0',
                dependencies: ['Component1'],
                settings: {},
            });
        });

        afterEach(() => {
            registry.clear();
        });

        it('should be a singleton', () => {
            const registry2 = ComponentRegistry.getInstance();
            expect(registry).toBe(registry2);
        });

        it('should register components successfully', () => {
            const result = registry.register(mockComponent1);
            expect(result).toBe(true);
            expect(registry.has('Component1')).toBe(true);
        });

        it('should prevent duplicate registrations', () => {
            registry.register(mockComponent1);
            const result = registry.register(mockComponent1);
            expect(result).toBe(false);
        });

        it('should unregister components successfully', () => {
            registry.register(mockComponent1);
            const result = registry.unregister('Component1');
            expect(result).toBe(true);
            expect(registry.has('Component1')).toBe(false);
        });

        it('should resolve dependencies correctly', () => {
            registry.register(mockComponent1);
            registry.register(mockComponent2);

            const order = registry.getStartupOrder();
            expect(order.indexOf('Component1')).toBeLessThan(order.indexOf('Component2'));
        });

        it('should detect circular dependencies', () => {
            const component3 = new BaseComponent({
                name: 'Component3',
                version: '1.0.0',
                dependencies: ['Component2'],
                settings: {},
            });

            // Create circular dependency: Component2 -> Component1, Component3 -> Component2, Component1 -> Component3
            mockComponent1 = new BaseComponent({
                name: 'Component1',
                version: '1.0.0',
                dependencies: ['Component3'],
                settings: {},
            });

            registry.register(mockComponent1);
            registry.register(mockComponent2);

            expect(() => registry.register(component3)).toThrow(/circular dependency/i);
        });

        it('should enable all components in correct order', async () => {
            registry.register(mockComponent1);
            registry.register(mockComponent2);

            const enableSpy1 = jest.spyOn(mockComponent1, 'enable');
            const enableSpy2 = jest.spyOn(mockComponent2, 'enable');

            await registry.enableAll();

            expect(enableSpy1).toHaveBeenCalledBefore(enableSpy2 as jest.Mock);
            expect(mockComponent1.getState()).toBe('active');
            expect(mockComponent2.getState()).toBe('active');
        });
    });

    describe('SignalManager', () => {
        let signalManager: SignalManager;

        beforeEach(() => {
            signalManager = SignalManager.getInstance();
            signalManager.clear();
        });

        afterEach(() => {
            signalManager.clear();
        });

        it('should be a singleton', () => {
            const signalManager2 = SignalManager.getInstance();
            expect(signalManager).toBe(signalManager2);
        });

        it('should connect and emit signals', () => {
            const callback = jest.fn();
            const mockObject = { connect: jest.fn(), disconnect: jest.fn() };

            signalManager.connect(mockObject, 'test-signal', callback);
            expect(mockObject.connect).toHaveBeenCalledWith('test-signal', callback);
        });

        it('should disconnect signals by connection ID', () => {
            const callback = jest.fn();
            const mockObject = {
                connect: jest.fn().mockReturnValue(123),
                disconnect: jest.fn(),
            };

            const connectionId = signalManager.connect(mockObject, 'test-signal', callback);
            signalManager.disconnect(connectionId);

            expect(mockObject.disconnect).toHaveBeenCalledWith(123);
        });

        it('should disconnect all signals for an object', () => {
            const mockObject = {
                connect: jest.fn().mockReturnValue(123),
                disconnect: jest.fn(),
            };

            signalManager.connect(mockObject, 'signal1', jest.fn());
            signalManager.connect(mockObject, 'signal2', jest.fn());

            signalManager.disconnectAll(mockObject);
            expect(mockObject.disconnect).toHaveBeenCalledTimes(2);
        });

        it('should handle connection errors gracefully', () => {
            const mockObject = {
                connect: jest.fn().mockImplementation(() => {
                    throw new Error('Connection failed');
                }),
                disconnect: jest.fn(),
            };

            expect(() => {
                signalManager.connect(mockObject, 'test-signal', jest.fn());
            }).not.toThrow();
        });
    });

    describe('Logger', () => {
        let logger: Logger;
        let originalConsole: typeof console;

        beforeEach(() => {
            originalConsole = global.console;
            global.console = {
                ...originalConsole,
                log: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            };

            logger = Logger.getInstance();
        });

        afterEach(() => {
            global.console = originalConsole;
        });

        it('should be a singleton', () => {
            const logger2 = Logger.getInstance();
            expect(logger).toBe(logger2);
        });

        it('should log messages with correct prefixes', () => {
            logger.info('Test message');
            logger.warn('Warning message');
            logger.error('Error message');
            logger.debug('Debug message');

            expect(console.log).toHaveBeenCalledWith('[GrayscaleToggle] Test message');
            expect(console.warn).toHaveBeenCalledWith('[GrayscaleToggle] Warning message');
            expect(console.error).toHaveBeenCalledWith('[GrayscaleToggle] Error message');
            expect(console.debug).toHaveBeenCalledWith('[GrayscaleToggle] Debug message');
        });

        it('should respect log level settings', () => {
            logger.setLevel('warn');

            logger.debug('Debug message');
            logger.info('Info message');
            logger.warn('Warning message');
            logger.error('Error message');

            expect(console.debug).not.toHaveBeenCalled();
            expect(console.log).not.toHaveBeenCalled();
            expect(console.warn).toHaveBeenCalled();
            expect(console.error).toHaveBeenCalled();
        });

        it('should format structured data correctly', () => {
            const data = { key: 'value', number: 42 };
            logger.info('Structured log', data);

            expect(console.log).toHaveBeenCalledWith(
                '[GrayscaleToggle] Structured log',
                JSON.stringify(data, null, 2)
            );
        });
    });
});
