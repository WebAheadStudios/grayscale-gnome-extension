/**
 * BaseComponent - Abstract base class for all extension components
 * Provides advanced lifecycle management, dependency injection, and error handling
 */

import GObject from 'gi://GObject';
import type { ExtensionComponent } from '../types/extension.js';

// Component lifecycle phases
export enum ComponentPhase {
    Created = 'created',
    Initializing = 'initializing',
    Ready = 'ready',
    Enabled = 'enabled',
    Disabling = 'disabling',
    Disabled = 'disabled',
    Destroyed = 'destroyed',
}

// Component lifecycle hooks
export interface LifecycleHooks {
    onInitialize?(): Promise<void> | void;
    onEnable?(): Promise<void> | void;
    onDisable?(): Promise<void> | void;
    onDestroy?(): Promise<void> | void;
    onError?(error: Error, phase: ComponentPhase): Promise<void> | void;
}

// Dependency injection interface
export interface ComponentDependencies {
    [key: string]: any;
}

// Component metadata
export interface ComponentMetadata {
    name: string;
    version: string;
    dependencies: string[];
    optional?: boolean;
    priority?: number;
}

// Component configuration
export interface ComponentConfig {
    enabled?: boolean;
    autoInit?: boolean;
    retryOnError?: boolean;
    maxRetries?: number;
    timeout?: number;
}

// Component state
export interface ComponentState {
    phase: ComponentPhase;
    initialized: boolean;
    enabled: boolean;
    error: Error | null;
    lastActivity: number;
    retryCount: number;
}

export const BaseComponent = GObject.registerClass(
    {
        GTypeName: 'GrayscaleBaseComponent',
        Signals: {
            'phase-changed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING], // new, old
            },
            error: {
                param_types: [GObject.TYPE_OBJECT], // Error object
            },
            ready: {},
            destroyed: {},
        },
    },
    class BaseComponent extends GObject.Object implements ExtensionComponent, LifecycleHooks {
        protected _metadata: ComponentMetadata;
        protected _config: ComponentConfig;
        protected _state: ComponentState;
        protected _dependencies: ComponentDependencies = {};
        protected _signalManager: any = null; // Will be injected
        protected _logger: any = null; // Will be injected
        protected _extension: any;

        constructor(extension: any, metadata: ComponentMetadata, config: ComponentConfig = {}) {
            super();

            this._extension = extension;
            this._metadata = metadata;
            this._config = {
                enabled: true,
                autoInit: true,
                retryOnError: true,
                maxRetries: 3,
                timeout: 5000,
                ...config,
            };

            this._state = {
                phase: ComponentPhase.Created,
                initialized: false,
                enabled: false,
                error: null,
                lastActivity: Date.now(),
                retryCount: 0,
            };
        }

        // Public API
        get metadata(): ComponentMetadata {
            return { ...this._metadata };
        }

        get config(): ComponentConfig {
            return { ...this._config };
        }

        get state(): ComponentState {
            return { ...this._state };
        }

        get phase(): ComponentPhase {
            return this._state.phase;
        }

        get isReady(): boolean {
            return (
                this._state.phase === ComponentPhase.Ready ||
                this._state.phase === ComponentPhase.Enabled
            );
        }

        get isEnabled(): boolean {
            return this._state.phase === ComponentPhase.Enabled;
        }

        get hasError(): boolean {
            return this._state.error !== null;
        }

        // Dependency injection
        injectDependency(name: string, dependency: any): void {
            this._dependencies[name] = dependency;

            // Set common dependencies
            if (name === 'signalManager') {
                this._signalManager = dependency;
            } else if (name === 'logger') {
                this._logger = dependency;
            }
        }

        getDependency<T = any>(name: string): T | null {
            return this._dependencies[name] || null;
        }

        // Lifecycle management
        async initialize(): Promise<boolean> {
            if (this._state.initialized) {
                return true;
            }

            try {
                this._setPhase(ComponentPhase.Initializing);

                // Check dependencies
                await this._checkDependencies();

                // Initialize component
                await this._executeWithTimeout(() => this.onInitialize?.());

                this._state.initialized = true;
                this._setPhase(ComponentPhase.Ready);
                this.emit('ready');

                this._log('debug', 'Component initialized successfully');
                return true;
            } catch (error) {
                this._handleError(error as Error, ComponentPhase.Initializing);
                return false;
            }
        }

        enable(): void {
            if (!this._state.initialized) {
                this._log('warn', 'Cannot enable component - not initialized');
                return;
            }

            if (this._state.phase === ComponentPhase.Enabled) {
                return;
            }

            try {
                this._setPhase(ComponentPhase.Enabled);
                this.onEnable?.();
                this._state.enabled = true;
                this._log('debug', 'Component enabled successfully');
            } catch (error) {
                this._handleError(error as Error, ComponentPhase.Enabled);
            }
        }

        disable(): void {
            if (this._state.phase !== ComponentPhase.Enabled) {
                return;
            }

            try {
                this._setPhase(ComponentPhase.Disabling);
                this.onDisable?.();
                this._state.enabled = false;
                this._setPhase(ComponentPhase.Disabled);
                this._log('debug', 'Component disabled successfully');
            } catch (error) {
                this._handleError(error as Error, ComponentPhase.Disabling);
            }
        }

        destroy(): void {
            if (this._state.phase === ComponentPhase.Destroyed) {
                return;
            }

            try {
                // Disable first if enabled
                if (this._state.enabled) {
                    this.disable();
                }

                this._setPhase(ComponentPhase.Destroyed);
                this.onDestroy?.();

                // Clean up dependencies
                this._dependencies = {};
                this._signalManager = null;
                this._logger = null;

                this.emit('destroyed');
                this._log('debug', 'Component destroyed successfully');
            } catch (error) {
                this._log('error', 'Error during component destruction', error);
            }
        }

        // Lifecycle entry point for subclasses to implement
        onInitialize?(): Promise<void> | void;

        // Optional lifecycle hooks
        onEnable?(): Promise<void> | void;
        onDisable?(): Promise<void> | void;
        onDestroy?(): Promise<void> | void;
        onError?(error: Error, phase: ComponentPhase): Promise<void> | void;

        // Protected utilities
        protected _log(level: string, message: string, ...args: any[]): void {
            const prefix = `[${this._metadata.name}]`;

            if (this._logger) {
                this._logger.log(level, `${prefix} ${message}`, ...args);
            } else {
                // Fallback to console
                const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
                console[method](`${prefix} ${message}`, ...args);
            }
        }

        protected _setPhase(newPhase: ComponentPhase): void {
            const oldPhase = this._state.phase;
            if (oldPhase === newPhase) {
                return;
            }

            this._state.phase = newPhase;
            this._state.lastActivity = Date.now();
            this.emit('phase-changed', newPhase, oldPhase);

            this._log('debug', `Phase changed: ${oldPhase} -> ${newPhase}`);
        }

        protected _handleError(error: Error, phase: ComponentPhase): void {
            this._state.error = error;
            this._state.retryCount++;

            this._log('error', `Error in phase ${phase}:`, error);
            this.emit('error', error);

            // Call error hook
            try {
                this.onError?.(error, phase);
            } catch (hookError) {
                this._log('error', 'Error in error hook:', hookError);
            }

            // Retry logic for non-critical phases
            if (
                this._config.retryOnError &&
                this._state.retryCount < (this._config.maxRetries || 3) &&
                phase !== ComponentPhase.Destroyed
            ) {
                this._log('info', `Retrying operation (attempt ${this._state.retryCount})`);

                // Retry with exponential backoff
                const delay = Math.min(1000 * Math.pow(2, this._state.retryCount - 1), 10000);
                setTimeout(() => {
                    if (phase === ComponentPhase.Initializing) {
                        this.initialize();
                    } else if (phase === ComponentPhase.Enabled) {
                        this.enable();
                    }
                }, delay);
            }
        }

        protected async _checkDependencies(): Promise<void> {
            const missing = this._metadata.dependencies.filter(dep => !this._dependencies[dep]);

            if (missing.length > 0) {
                throw new Error(`Missing dependencies: ${missing.join(', ')}`);
            }
        }

        protected async _executeWithTimeout(operation: () => Promise<void> | void): Promise<void> {
            if (!this._config.timeout) {
                await operation();
                return;
            }

            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Operation timeout')), this._config.timeout);
            });

            const operationPromise = Promise.resolve(operation());
            await Promise.race([operationPromise, timeoutPromise]);
        }
    }
);
// eslint-disable-next-line no-redeclare
export type BaseComponent = InstanceType<typeof BaseComponent>;
