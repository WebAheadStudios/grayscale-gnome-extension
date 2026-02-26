/**
 * SignalManager - Professional signal handling with automatic cleanup
 * Type-safe signal connections, debouncing, and comprehensive resource management
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

// Signal connection metadata
export interface SignalConnection {
    id: number;
    signalId: number;
    object: GObject.Object;
    signal: string;
    handler: any;
    namespace?: string;
    once?: boolean;
    debounce?: number;
    throttle?: number;
    lastExecution?: number;
    timeoutId?: number;
    active: boolean;
    created: number;
    executions: number;
}

// Connection options
export interface ConnectionOptions {
    namespace?: string;
    once?: boolean;
    debounce?: number;
    throttle?: number;
    priority?: number;
    swallow?: boolean;
    errorHandler?: (error: Error, connection: SignalConnection) => void;
}

// Signal statistics
export interface SignalStats {
    totalConnections: number;
    activeConnections: number;
    byNamespace: Map<string, number>;
    bySignal: Map<string, number>;
    totalExecutions: number;
    averageExecutionTime: number;
    errors: number;
}

// Connection group for bulk operations
export interface ConnectionGroup {
    name: string;
    connections: Set<SignalConnection>;
    active: boolean;
}

// Event types
export interface SignalManagerEvents {
    'connection-added': { connection: SignalConnection };
    'connection-removed': { connection: SignalConnection };
    'connection-error': { connection: SignalConnection; error: Error };
    'group-created': { group: string };
    'group-destroyed': { group: string };
    'stats-updated': { stats: SignalStats };
}

export const SignalManager = GObject.registerClass(
    {
        GTypeName: 'GrayscaleSignalManager',
        Signals: {
            'connection-added': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
            'connection-removed': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
            'connection-error': {
                param_types: [GObject.TYPE_JSOBJECT, GObject.TYPE_JSOBJECT],
            },
            'group-created': {
                param_types: [GObject.TYPE_STRING],
            },
            'group-destroyed': {
                param_types: [GObject.TYPE_STRING],
            },
            'stats-updated': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
        },
    },
    class SignalManager extends GObject.Object {
        private _connections: Map<number, SignalConnection> = new Map();
        private _namespaces: Map<string, Set<SignalConnection>> = new Map();
        private _objects: Map<GObject.Object, Set<SignalConnection>> = new Map();
        private _groups: Map<string, ConnectionGroup> = new Map();
        private _nextId = 1;
        private _stats: SignalStats;
        private _logger: any = null;
        private _defaultErrorHandler?: (error: Error, connection: SignalConnection) => void;
        private _destroyed = false;

        constructor() {
            super();

            this._stats = {
                totalConnections: 0,
                activeConnections: 0,
                byNamespace: new Map(),
                bySignal: new Map(),
                totalExecutions: 0,
                averageExecutionTime: 0,
                errors: 0,
            };
        }

        // Public API
        connectSignal(
            object: GObject.Object,
            signal: string,
            handler: (...args: any[]) => any,
            options: ConnectionOptions = {}
        ): number {
            if (this._destroyed) {
                throw new Error('SignalManager has been destroyed');
            }

            if (!object || typeof object.connect !== 'function') {
                throw new Error('Invalid object for signal connection');
            }

            // Create wrapped handler for enhanced functionality
            const wrappedHandler = this._createWrappedHandler(handler, options);

            // Connect to the object
            const signalId = object.connect(signal, wrappedHandler);
            const connectionId = this._nextId++;

            // Create connection metadata
            const connection: SignalConnection = {
                id: connectionId,
                signalId,
                object,
                signal,
                handler: wrappedHandler,
                namespace: options.namespace,
                once: options.once,
                debounce: options.debounce,
                throttle: options.throttle,
                active: true,
                created: Date.now(),
                executions: 0,
            };

            // Store connection
            this._connections.set(connectionId, connection);

            // Track by object
            if (!this._objects.has(object)) {
                this._objects.set(object, new Set());
            }
            this._objects.get(object)!.add(connection);

            // Track by namespace
            if (options.namespace) {
                if (!this._namespaces.has(options.namespace)) {
                    this._namespaces.set(options.namespace, new Set());
                }
                this._namespaces.get(options.namespace)!.add(connection);
            }

            // Update stats
            this._updateStats();

            this.emit('connection-added', connection);
            this._log(
                'debug',
                `Connected signal '${signal}' for object ${object.constructor.name} (ID: ${connectionId})`
            );

            return connectionId;
        }

        connectOnce(
            object: GObject.Object,
            signal: string,
            handler: (...args: any[]) => any,
            options: ConnectionOptions = {}
        ): number {
            return this.connectSignal(object, signal, handler, { ...options, once: true });
        }

        connectDebounced(
            object: GObject.Object,
            signal: string,
            handler: (...args: any[]) => any,
            delay: number,
            options: ConnectionOptions = {}
        ): number {
            return this.connectSignal(object, signal, handler, { ...options, debounce: delay });
        }

        connectThrottled(
            object: GObject.Object,
            signal: string,
            handler: (...args: any[]) => any,
            delay: number,
            options: ConnectionOptions = {}
        ): number {
            return this.connectSignal(object, signal, handler, { ...options, throttle: delay });
        }

        override disconnect(connectionId: number): boolean {
            const connection = this._connections.get(connectionId);
            if (!connection || !connection.active) {
                return false;
            }

            return this._disconnectConnection(connection);
        }

        disconnectAll(): void {
            const connections = Array.from(this._connections.values());
            for (const connection of connections) {
                this._disconnectConnection(connection);
            }

            this._log('info', `Disconnected all ${connections.length} signal connections`);
        }

        disconnectByNamespace(namespace: string): number {
            const connections = this._namespaces.get(namespace);
            if (!connections) {
                return 0;
            }

            let count = 0;
            for (const connection of Array.from(connections)) {
                if (this._disconnectConnection(connection)) {
                    count++;
                }
            }

            this._log('debug', `Disconnected ${count} connections from namespace '${namespace}'`);
            return count;
        }

        disconnectByObject(object: GObject.Object): number {
            const connections = this._objects.get(object);
            if (!connections) {
                return 0;
            }

            let count = 0;
            for (const connection of Array.from(connections)) {
                if (this._disconnectConnection(connection)) {
                    count++;
                }
            }

            this._log(
                'debug',
                `Disconnected ${count} connections from object ${object.constructor.name}`
            );
            return count;
        }

        // Group management
        createGroup(name: string): void {
            if (this._groups.has(name)) {
                this._log('warn', `Group '${name}' already exists`);
                return;
            }

            this._groups.set(name, {
                name,
                connections: new Set(),
                active: true,
            });

            this.emit('group-created', name);
            this._log('debug', `Created signal group '${name}'`);
        }

        addToGroup(connectionId: number, groupName: string): boolean {
            const connection = this._connections.get(connectionId);
            const group = this._groups.get(groupName);

            if (!connection || !group) {
                return false;
            }

            group.connections.add(connection);
            return true;
        }

        disconnectGroup(groupName: string): number {
            const group = this._groups.get(groupName);
            if (!group) {
                return 0;
            }

            let count = 0;
            for (const connection of Array.from(group.connections)) {
                if (this._disconnectConnection(connection)) {
                    count++;
                }
            }

            group.active = false;
            this._log('debug', `Disconnected group '${groupName}' (${count} connections)`);
            return count;
        }

        destroyGroup(groupName: string): void {
            const group = this._groups.get(groupName);
            if (!group) {
                return;
            }

            this.disconnectGroup(groupName);
            this._groups.delete(groupName);
            this.emit('group-destroyed', groupName);
            this._log('debug', `Destroyed signal group '${groupName}'`);
        }

        // Inspection and debugging
        getConnection(connectionId: number): SignalConnection | null {
            return this._connections.get(connectionId) || null;
        }

        getActiveConnections(): SignalConnection[] {
            return Array.from(this._connections.values()).filter(c => c.active);
        }

        getConnectionsByNamespace(namespace: string): SignalConnection[] {
            const connections = this._namespaces.get(namespace);
            return connections ? Array.from(connections).filter(c => c.active) : [];
        }

        getConnectionsByObject(object: GObject.Object): SignalConnection[] {
            const connections = this._objects.get(object);
            return connections ? Array.from(connections).filter(c => c.active) : [];
        }

        getStats(): SignalStats {
            return { ...this._stats };
        }

        // Configuration
        setDefaultErrorHandler(
            handler: (error: Error, connection: SignalConnection) => void
        ): void {
            this._defaultErrorHandler = handler;
        }

        setLogger(logger: any): void {
            this._logger = logger;
        }

        // Lifecycle
        destroy(): void {
            if (this._destroyed) {
                return;
            }

            this._log('info', 'Destroying SignalManager...');

            // Disconnect all signals
            this.disconnectAll();

            // Clean up groups
            for (const groupName of this._groups.keys()) {
                this.destroyGroup(groupName);
            }

            // Clear all data structures
            this._connections.clear();
            this._namespaces.clear();
            this._objects.clear();
            this._groups.clear();

            this._destroyed = true;
            this._log('info', 'SignalManager destroyed');
        }

        // Private methods
        private _createWrappedHandler(
            originalHandler: (...args: any[]) => any,
            options: ConnectionOptions
        ): (...args: any[]) => any {
            return (...args: any[]) => {
                const connectionId = args[args.length - 1]; // Add connection ID as last argument
                const connection = this._connections.get(connectionId);

                if (!connection || !connection.active) {
                    return;
                }

                const startTime = Date.now();

                try {
                    // Handle debouncing
                    if (options.debounce) {
                        if (connection.timeoutId) {
                            GLib.source_remove(connection.timeoutId);
                        }

                        connection.timeoutId = GLib.timeout_add(
                            GLib.PRIORITY_DEFAULT,
                            options.debounce,
                            () => {
                                this._executeHandler(originalHandler, args, connection, startTime);
                                connection.timeoutId = undefined;
                                return GLib.SOURCE_REMOVE;
                            }
                        );
                        return;
                    }

                    // Handle throttling
                    if (options.throttle && connection.lastExecution) {
                        const timeSinceLastExecution = Date.now() - connection.lastExecution;
                        if (timeSinceLastExecution < options.throttle) {
                            return;
                        }
                    }

                    this._executeHandler(originalHandler, args, connection, startTime);
                } catch (error) {
                    this._handleConnectionError(error as Error, connection);
                }
            };
        }

        private _executeHandler(
            handler: (...args: any[]) => any,
            args: any[],
            connection: SignalConnection,
            startTime: number
        ): void {
            try {
                // Execute the original handler
                handler.apply(null, args);

                // Update connection stats
                connection.executions++;
                connection.lastExecution = Date.now();

                // Update global stats
                this._stats.totalExecutions++;
                const executionTime = Date.now() - startTime;
                this._stats.averageExecutionTime =
                    (this._stats.averageExecutionTime + executionTime) / 2;

                // Handle once connections
                if (connection.once) {
                    this._disconnectConnection(connection);
                }
            } catch (error) {
                this._handleConnectionError(error as Error, connection);
            }
        }

        private _handleConnectionError(error: Error, connection: SignalConnection): void {
            this._stats.errors++;
            this.emit('connection-error', connection, error);

            // Use connection-specific error handler or default
            const errorHandler = connection.handler?.errorHandler || this._defaultErrorHandler;

            if (errorHandler) {
                try {
                    errorHandler(error, connection);
                } catch (handlerError) {
                    this._log('error', 'Error in error handler:', handlerError);
                }
            }

            this._log('error', `Signal handler error in ${connection.signal}:`, error);
        }

        private _disconnectConnection(connection: SignalConnection): boolean {
            if (!connection.active) {
                return false;
            }

            try {
                // Clear any pending timeouts
                if (connection.timeoutId) {
                    GLib.source_remove(connection.timeoutId);
                    connection.timeoutId = undefined;
                }

                // Disconnect from the object
                connection.object.disconnect(connection.signalId);
                connection.active = false;

                // Remove from tracking structures
                this._connections.delete(connection.id);

                const objectConnections = this._objects.get(connection.object);
                if (objectConnections) {
                    objectConnections.delete(connection);
                    if (objectConnections.size === 0) {
                        this._objects.delete(connection.object);
                    }
                }

                if (connection.namespace) {
                    const namespaceConnections = this._namespaces.get(connection.namespace);
                    if (namespaceConnections) {
                        namespaceConnections.delete(connection);
                        if (namespaceConnections.size === 0) {
                            this._namespaces.delete(connection.namespace);
                        }
                    }
                }

                // Remove from groups
                for (const group of this._groups.values()) {
                    group.connections.delete(connection);
                }

                this._updateStats();
                this.emit('connection-removed', connection);

                return true;
            } catch (error) {
                this._log('error', `Error disconnecting signal ${connection.signal}:`, error);
                return false;
            }
        }

        private _updateStats(): void {
            this._stats.totalConnections = this._connections.size;
            this._stats.activeConnections = Array.from(this._connections.values()).filter(
                c => c.active
            ).length;

            // Update namespace stats
            this._stats.byNamespace.clear();
            for (const [namespace, connections] of this._namespaces.entries()) {
                this._stats.byNamespace.set(namespace, connections.size);
            }

            // Update signal stats
            this._stats.bySignal.clear();
            for (const connection of this._connections.values()) {
                if (connection.active) {
                    const current = this._stats.bySignal.get(connection.signal) || 0;
                    this._stats.bySignal.set(connection.signal, current + 1);
                }
            }

            this.emit('stats-updated', this._stats);
        }

        private _log(level: string, message: string, ...args: any[]): void {
            const prefix = '[SignalManager]';

            if (this._logger) {
                this._logger.log(level, `${prefix} ${message}`, ...args);
            } else {
                // Fallback to console
                const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
                console[method](`${prefix} ${message}`, ...args);
            }
        }
    }
);
// eslint-disable-next-line no-redeclare
export type SignalManager = InstanceType<typeof SignalManager>;
