/**
 * ComponentRegistry - Advanced dependency injection and component lifecycle management
 * Based on TilingShell architectural patterns for professional component coordination
 */

import GObject from 'gi://GObject';
import { BaseComponent, ComponentConfig, ComponentMetadata } from './BaseComponent.js';

// Component factory interface
export interface ComponentFactory<T extends BaseComponent = BaseComponent> {
    create(extension: any, metadata: ComponentMetadata, config?: ComponentConfig): T;
    dependencies: string[];
    priority: number;
}

// Component registration
export interface ComponentRegistration {
    name: string;
    factory: ComponentFactory;
    metadata: ComponentMetadata;
    config: ComponentConfig;
    instance?: BaseComponent;
    status: 'registered' | 'creating' | 'ready' | 'error';
    error?: Error;
}

// Dependency resolution result
export interface DependencyResolution {
    resolved: string[];
    unresolved: string[];
    circular: string[][];
    order: string[];
}

// Registry events
export interface RegistryEvents {
    'component-registered': { name: string; registration: ComponentRegistration };
    'component-created': { name: string; component: BaseComponent };
    'component-initialized': { name: string; component: BaseComponent };
    'component-destroyed': { name: string; component: BaseComponent };
    'dependency-resolved': { component: string; dependency: string };
    'registry-ready': { components: string[] };
    'registry-error': { component: string; error: Error };
}

// Registry configuration
export interface RegistryConfig {
    autoInitialize?: boolean;
    strictDependencies?: boolean;
    circularDependencyCheck?: boolean;
    maxRetries?: number;
    initializationTimeout?: number;
}

export const ComponentRegistry = GObject.registerClass(
    {
        GTypeName: 'GrayscaleComponentRegistry',
        Signals: {
            'component-registered': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_VARIANT],
            },
            'component-created': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_OBJECT],
            },
            'component-initialized': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_OBJECT],
            },
            'component-destroyed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING], // name, reason
            },
            'dependency-resolved': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING],
            },
            'registry-ready': {
                param_types: [GObject.TYPE_VARIANT], // component names array
            },
            'registry-error': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_OBJECT],
            },
        },
    },
    class ComponentRegistry extends GObject.Object {
        private _extension: any;
        private _config: RegistryConfig;
        private _registrations: Map<string, ComponentRegistration> = new Map();
        private _instances: Map<string, BaseComponent> = new Map();
        private _dependencies: Map<string, Set<string>> = new Map();
        private _dependents: Map<string, Set<string>> = new Map();
        private _initializationOrder: string[] = [];
        private _isInitializing = false;
        private _logger: any = null;

        constructor(extension: any, config: RegistryConfig = {}) {
            super();

            this._extension = extension;
            this._config = {
                autoInitialize: true,
                strictDependencies: true,
                circularDependencyCheck: true,
                maxRetries: 3,
                initializationTimeout: 30000,
                ...config,
            };
        }

        // Public API
        register<T extends BaseComponent>(
            name: string,
            factory: ComponentFactory<T>,
            metadata: ComponentMetadata,
            config: ComponentConfig = {}
        ): void {
            if (this._registrations.has(name)) {
                throw new Error(`Component '${name}' is already registered`);
            }

            const registration: ComponentRegistration = {
                name,
                factory,
                metadata: {
                    ...metadata,
                    name,
                },
                config: {
                    enabled: true,
                    autoInit: true,
                    ...config,
                },
                status: 'registered',
            };

            this._registrations.set(name, registration);

            // Track dependencies
            this._dependencies.set(name, new Set(factory.dependencies));

            // Track dependents
            for (const dep of factory.dependencies) {
                if (!this._dependents.has(dep)) {
                    this._dependents.set(dep, new Set());
                }
                this._dependents.get(dep)!.add(name);
            }

            this.emit('component-registered', name, registration);
            this._log(
                'debug',
                `Registered component '${name}' with dependencies: [${factory.dependencies.join(', ')}]`
            );

            // Auto-initialize if enabled
            if (this._config.autoInitialize && !this._isInitializing) {
                this._initializeComponents().catch(error => {
                    this._log('error', 'Auto-initialization failed:', error);
                });
            }
        }

        get<T extends BaseComponent>(name: string): T | null {
            return (this._instances.get(name) as T) || null;
        }

        has(name: string): boolean {
            return this._instances.has(name);
        }

        getAll(): Map<string, BaseComponent> {
            return new Map(this._instances);
        }

        isRegistered(name: string): boolean {
            return this._registrations.has(name);
        }

        getRegistration(name: string): ComponentRegistration | null {
            return this._registrations.get(name) || null;
        }

        // Lifecycle management
        async initializeAll(): Promise<void> {
            if (this._isInitializing) {
                this._log('warn', 'Initialization already in progress');
                return;
            }

            try {
                this._isInitializing = true;
                await this._initializeComponents();
                this.emit('registry-ready', Array.from(this._instances.keys()));
                this._log('info', 'All components initialized successfully');
            } catch (error) {
                this._log('error', 'Component initialization failed:', error);
                throw error;
            } finally {
                this._isInitializing = false;
            }
        }

        async destroyAll(): Promise<void> {
            this._log('info', 'Destroying all components...');

            // Destroy in reverse order
            const destroyOrder = [...this._initializationOrder].reverse();

            for (const name of destroyOrder) {
                await this._destroyComponent(name);
            }

            this._instances.clear();
            this._initializationOrder = [];
            this._log('info', 'All components destroyed');
        }

        async destroyComponent(name: string): Promise<void> {
            await this._destroyComponent(name);
        }

        // Dependency injection
        injectDependency(componentName: string, dependencyName: string, dependency: any): void {
            const component = this._instances.get(componentName);
            if (!component) {
                throw new Error(`Component '${componentName}' not found`);
            }

            component.injectDependency(dependencyName, dependency);
            this.emit('dependency-resolved', componentName, dependencyName);
            this._log('debug', `Injected dependency '${dependencyName}' into '${componentName}'`);
        }

        // Dependency analysis
        resolveDependencies(): DependencyResolution {
            const resolved: string[] = [];
            const unresolved: string[] = [];
            const visiting = new Set<string>();
            const visited = new Set<string>();
            const circular: string[][] = [];

            // Find components with no dependencies
            const _noDeps = Array.from(this._registrations.keys()).filter(
                name => this._dependencies.get(name)?.size === 0
            );

            // Depth-first search for dependency resolution
            const visit = (name: string, path: string[] = []): void => {
                if (visited.has(name)) {
                    return;
                }

                if (visiting.has(name)) {
                    // Circular dependency detected
                    const cycleStart = path.indexOf(name);
                    if (cycleStart !== -1) {
                        circular.push(path.slice(cycleStart).concat([name]));
                    }
                    return;
                }

                visiting.add(name);
                const deps = this._dependencies.get(name) || new Set();

                for (const dep of deps) {
                    if (!this._registrations.has(dep)) {
                        if (!unresolved.includes(dep)) {
                            unresolved.push(dep);
                        }
                    } else {
                        visit(dep, [...path, name]);
                    }
                }

                visiting.delete(name);
                visited.add(name);
                resolved.push(name);
            };

            // Visit all components
            for (const name of this._registrations.keys()) {
                if (!visited.has(name)) {
                    visit(name);
                }
            }

            // Generate initialization order (topological sort)
            const order = this._generateInitializationOrder(resolved);

            return {
                resolved,
                unresolved,
                circular,
                order,
            };
        }

        // Private methods
        private async _initializeComponents(): Promise<void> {
            // Resolve dependencies
            const resolution = this.resolveDependencies();

            // Check for issues
            if (this._config.circularDependencyCheck && resolution.circular.length > 0) {
                throw new Error(
                    `Circular dependencies detected: ${resolution.circular.map(c => c.join(' -> ')).join(', ')}`
                );
            }

            if (this._config.strictDependencies && resolution.unresolved.length > 0) {
                throw new Error(`Unresolved dependencies: ${resolution.unresolved.join(', ')}`);
            }

            // Initialize components in dependency order
            this._initializationOrder = resolution.order;

            for (const name of this._initializationOrder) {
                await this._createAndInitializeComponent(name);
            }
        }

        private async _createAndInitializeComponent(name: string): Promise<void> {
            const registration = this._registrations.get(name);
            if (!registration) {
                throw new Error(`Component '${name}' not registered`);
            }

            if (this._instances.has(name)) {
                return; // Already created
            }

            try {
                registration.status = 'creating';

                // Create component instance
                this._log('debug', `Creating component '${name}'...`);
                const instance = registration.factory.create(
                    this._extension,
                    registration.metadata,
                    registration.config
                );

                this._instances.set(name, instance);
                registration.instance = instance;

                // Inject dependencies
                await this._injectDependencies(name, instance);

                // Initialize component
                this._log('debug', `Initializing component '${name}'...`);
                const success = await instance.initialize();

                if (!success) {
                    throw new Error(`Component '${name}' failed to initialize`);
                }

                registration.status = 'ready';
                this.emit('component-created', name, instance);
                this.emit('component-initialized', name, instance);

                this._log('info', `Component '${name}' initialized successfully`);
            } catch (error) {
                registration.status = 'error';
                registration.error = error as Error;
                this.emit('registry-error', name, error);
                this._log('error', `Failed to initialize component '${name}':`, error);
                throw error;
            }
        }

        private async _injectDependencies(
            componentName: string,
            component: BaseComponent
        ): Promise<void> {
            const dependencies = this._dependencies.get(componentName) || new Set();

            for (const depName of dependencies) {
                const dependency = this._instances.get(depName);
                if (dependency) {
                    component.injectDependency(depName, dependency);
                    this.emit('dependency-resolved', componentName, depName);
                } else if (this._config.strictDependencies) {
                    throw new Error(`Dependency '${depName}' not available for '${componentName}'`);
                }
            }

            // Inject common services
            if (this._logger) {
                component.injectDependency('logger', this._logger);
            }
        }

        private async _destroyComponent(name: string): Promise<void> {
            const component = this._instances.get(name);
            if (!component) {
                return;
            }

            try {
                this._log('debug', `Destroying component '${name}'...`);

                // Destroy dependents first
                const dependents = this._dependents.get(name) || new Set();
                for (const dependent of dependents) {
                    await this._destroyComponent(dependent);
                }

                // Destroy the component
                component.destroy();
                this._instances.delete(name);

                const registration = this._registrations.get(name);
                if (registration) {
                    registration.instance = undefined;
                    registration.status = 'registered';
                }

                this.emit('component-destroyed', name, 'manual');
                this._log('debug', `Component '${name}' destroyed successfully`);
            } catch (error) {
                this._log('error', `Error destroying component '${name}':`, error);
            }
        }

        private _generateInitializationOrder(resolved: string[]): string[] {
            // Topological sort based on dependencies
            const order: string[] = [];
            const visited = new Set<string>();

            const visit = (name: string): void => {
                if (visited.has(name)) {
                    return;
                }

                const deps = this._dependencies.get(name) || new Set();
                for (const dep of deps) {
                    if (this._registrations.has(dep)) {
                        visit(dep);
                    }
                }

                visited.add(name);
                order.push(name);
            };

            for (const name of resolved) {
                if (this._registrations.has(name)) {
                    visit(name);
                }
            }

            return order;
        }

        private _log(level: string, message: string, ...args: any[]): void {
            const prefix = '[ComponentRegistry]';

            if (this._logger) {
                this._logger.log(level, `${prefix} ${message}`, ...args);
            } else {
                // Fallback to console
                const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
                console[method](`${prefix} ${message}`, ...args);
            }
        }

        // Logger injection
        setLogger(logger: any): void {
            this._logger = logger;
        }
    }
);
// eslint-disable-next-line no-redeclare
export type ComponentRegistry = InstanceType<typeof ComponentRegistry>;
