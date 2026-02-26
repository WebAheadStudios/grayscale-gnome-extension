/**
 * ErrorBoundary - Comprehensive error handling and recovery system
 * Prevents cascade failures and provides graceful degradation strategies
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

// Error severity levels
export enum ErrorSeverity {
    Low = 'low',
    Medium = 'medium',
    High = 'high',
    Critical = 'critical',
}

// Error categories for better handling
export enum ErrorCategory {
    Initialization = 'initialization',
    Runtime = 'runtime',
    Resource = 'resource',
    Signal = 'signal',
    State = 'state',
    UI = 'ui',
    External = 'external',
}

// Recovery strategies
export enum RecoveryStrategy {
    Ignore = 'ignore',
    Retry = 'retry',
    Restart = 'restart',
    Degrade = 'degrade',
    Isolate = 'isolate',
    Escalate = 'escalate',
}

// Error context information
export interface ErrorContext {
    component?: string;
    operation?: string;
    phase?: string;
    metadata?: Record<string, any>;
    timestamp: number;
    stackTrace?: string;
}

// Enhanced error information
export interface BoundaryError {
    id: string;
    original: Error;
    severity: ErrorSeverity;
    category: ErrorCategory;
    context: ErrorContext;
    recoveryStrategy: RecoveryStrategy;
    retryCount: number;
    recovered: boolean;
    isolatedAt?: number;
}

// Recovery action interface
export interface RecoveryAction {
    strategy: RecoveryStrategy;
    maxRetries?: number;
    retryDelay?: number;
    timeoutMs?: number;
    fallbackAction?: () => Promise<void> | void;
    successCheck?: () => boolean;
}

// Error handler configuration
export interface ErrorHandlerConfig {
    maxErrors?: number;
    timeWindow?: number; // ms
    retryDelay?: number;
    maxRetries?: number;
    enableCircuitBreaker?: boolean;
    circuitBreakerThreshold?: number;
    circuitBreakerTimeout?: number;
    enableReporting?: boolean;
}

// Recovery result
export interface RecoveryResult {
    success: boolean;
    strategy: RecoveryStrategy;
    retriesUsed: number;
    timeElapsed: number;
    fallbackUsed: boolean;
    error?: Error;
}

// Circuit breaker state
enum CircuitState {
    Closed = 'closed',
    Open = 'open',
    HalfOpen = 'half-open',
}

// Circuit breaker
class CircuitBreaker {
    private _state: CircuitState = CircuitState.Closed;
    private _failures = 0;
    private _lastFailureTime = 0;
    private _threshold: number;
    private _timeout: number;

    constructor(threshold = 5, timeout = 60000) {
        this._threshold = threshold;
        this._timeout = timeout;
    }

    canExecute(): boolean {
        if (this._state === CircuitState.Closed) {
            return true;
        }

        if (this._state === CircuitState.Open) {
            const elapsed = Date.now() - this._lastFailureTime;
            if (elapsed >= this._timeout) {
                this._state = CircuitState.HalfOpen;
                return true;
            }
            return false;
        }

        // Half-open state - allow one attempt
        return true;
    }

    onSuccess(): void {
        this._failures = 0;
        this._state = CircuitState.Closed;
    }

    onFailure(): void {
        this._failures++;
        this._lastFailureTime = Date.now();

        if (this._state === CircuitState.HalfOpen || this._failures >= this._threshold) {
            this._state = CircuitState.Open;
        }
    }

    get state(): CircuitState {
        return this._state;
    }
}

export const ErrorBoundary = GObject.registerClass(
    {
        GTypeName: 'GrayscaleErrorBoundary',
        Signals: {
            'error-caught': {
                param_types: [GObject.TYPE_JSOBJECT], // BoundaryError
            },
            'recovery-attempted': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING], // errorId, strategy
            },
            'recovery-succeeded': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_JSOBJECT], // errorId, result
            },
            'recovery-failed': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_JSOBJECT], // errorId, result
            },
            'circuit-breaker-opened': {
                param_types: [GObject.TYPE_STRING], // component
            },
            'circuit-breaker-closed': {
                param_types: [GObject.TYPE_STRING], // component
            },
            'degraded-mode-activated': {
                param_types: [GObject.TYPE_STRING], // component
            },
        },
    },
    class ErrorBoundary extends GObject.Object {
        private _config: Required<ErrorHandlerConfig>;
        private _errors: Map<string, BoundaryError> = new Map();
        private _errorHistory: BoundaryError[] = [];
        private _circuitBreakers: Map<string, CircuitBreaker> = new Map();
        private _degradedComponents: Set<string> = new Set();
        private _isolatedComponents: Set<string> = new Set();
        private _recoveryActions: Map<ErrorCategory, RecoveryAction> = new Map();
        private _nextErrorId = 1;
        private _logger: any = null;

        constructor(config: ErrorHandlerConfig = {}) {
            super();

            this._config = {
                maxErrors: 100,
                timeWindow: 300000, // 5 minutes
                retryDelay: 1000,
                maxRetries: 3,
                enableCircuitBreaker: true,
                circuitBreakerThreshold: 5,
                circuitBreakerTimeout: 60000,
                enableReporting: true,
                ...config,
            };

            this._setupDefaultRecoveryActions();
        }

        // Public API
        async catch<T>(
            operation: () => Promise<T> | T,
            context: Partial<ErrorContext> = {},
            recoveryAction?: RecoveryAction
        ): Promise<T | null> {
            const fullContext: ErrorContext = {
                timestamp: Date.now(),
                ...context,
            };

            try {
                // Check circuit breaker
                if (context.component && this._config.enableCircuitBreaker) {
                    const breaker = this._getCircuitBreaker(context.component);
                    if (!breaker.canExecute()) {
                        throw new Error(
                            `Circuit breaker is open for component: ${context.component}`
                        );
                    }
                }

                // Execute operation
                const result = await Promise.resolve(operation());

                // Mark success for circuit breaker
                if (context.component && this._config.enableCircuitBreaker) {
                    this._getCircuitBreaker(context.component).onSuccess();
                }

                return result;
            } catch (error) {
                return await this._handleError(error as Error, fullContext, recoveryAction);
            }
        }

        wrapFunction<TArgs extends any[], TReturn>(
            fn: (...args: TArgs) => TReturn | Promise<TReturn>,
            context: Partial<ErrorContext> = {},
            recoveryAction?: RecoveryAction
        ): (...args: TArgs) => Promise<TReturn | null> {
            return async (...args: TArgs): Promise<TReturn | null> => {
                return this.catch(() => fn(...args), context, recoveryAction);
            };
        }

        // Configuration
        setRecoveryAction(category: ErrorCategory, action: RecoveryAction): void {
            this._recoveryActions.set(category, action);
        }

        getRecoveryAction(category: ErrorCategory): RecoveryAction | null {
            return this._recoveryActions.get(category) || null;
        }

        // Component management
        isComponentDegraded(component: string): boolean {
            return this._degradedComponents.has(component);
        }

        isComponentIsolated(component: string): boolean {
            return this._isolatedComponents.has(component);
        }

        activateDegradedMode(component: string): void {
            if (!this._degradedComponents.has(component)) {
                this._degradedComponents.add(component);
                this.emit('degraded-mode-activated', component);
                this._log('warn', `Activated degraded mode for component: ${component}`);
            }
        }

        deactivateDegradedMode(component: string): void {
            if (this._degradedComponents.delete(component)) {
                this._log('info', `Deactivated degraded mode for component: ${component}`);
            }
        }

        isolateComponent(component: string): void {
            if (!this._isolatedComponents.has(component)) {
                this._isolatedComponents.add(component);
                this._log('warn', `Isolated component due to repeated failures: ${component}`);
            }
        }

        restoreComponent(component: string): void {
            this._isolatedComponents.delete(component);
            this._degradedComponents.delete(component);

            // Reset circuit breaker
            if (this._circuitBreakers.has(component)) {
                this._circuitBreakers.delete(component);
            }

            this._log('info', `Restored component: ${component}`);
        }

        // Error inspection
        getError(errorId: string): BoundaryError | null {
            return this._errors.get(errorId) || null;
        }

        getErrorHistory(component?: string): BoundaryError[] {
            if (component) {
                return this._errorHistory.filter(e => e.context.component === component);
            }
            return [...this._errorHistory];
        }

        getCriticalErrors(): BoundaryError[] {
            return this._errorHistory.filter(e => e.severity === ErrorSeverity.Critical);
        }

        getComponentStats(component: string): {
            totalErrors: number;
            recoveredErrors: number;
            activeErrors: number;
            circuitBreakerState?: CircuitState;
        } {
            const errors = this._errorHistory.filter(e => e.context.component === component);
            const activeErrors = Array.from(this._errors.values()).filter(
                e => e.context.component === component && !e.recovered
            );

            const breaker = this._circuitBreakers.get(component);

            return {
                totalErrors: errors.length,
                recoveredErrors: errors.filter(e => e.recovered).length,
                activeErrors: activeErrors.length,
                circuitBreakerState: breaker?.state,
            };
        }

        // Lifecycle
        cleanup(): void {
            const now = Date.now();
            const cutoff = now - this._config.timeWindow;

            // Remove old errors
            const oldErrors = this._errorHistory.filter(e => e.context.timestamp < cutoff);
            this._errorHistory = this._errorHistory.filter(e => e.context.timestamp >= cutoff);

            // Clean up resolved errors from active map
            for (const [id, error] of this._errors.entries()) {
                if (error.recovered || error.context.timestamp < cutoff) {
                    this._errors.delete(id);
                }
            }

            this._log('debug', `Cleaned up ${oldErrors.length} old errors`);
        }

        destroy(): void {
            this._errors.clear();
            this._errorHistory = [];
            this._circuitBreakers.clear();
            this._degradedComponents.clear();
            this._isolatedComponents.clear();
            this._recoveryActions.clear();

            this._log('info', 'ErrorBoundary destroyed');
        }

        setLogger(logger: any): void {
            this._logger = logger;
        }

        // Private methods
        private async _handleError(
            error: Error,
            context: ErrorContext,
            recoveryAction?: RecoveryAction
        ): Promise<any> {
            const boundaryError = this._createBoundaryError(error, context);

            // Store error
            this._errors.set(boundaryError.id, boundaryError);
            this._errorHistory.push(boundaryError);

            // Emit error event
            this.emit('error-caught', boundaryError);

            // Update circuit breaker
            if (context.component && this._config.enableCircuitBreaker) {
                const breaker = this._getCircuitBreaker(context.component);
                breaker.onFailure();

                if (breaker.state === CircuitState.Open) {
                    this.emit('circuit-breaker-opened', context.component);
                }
            }

            // Determine recovery strategy
            const action =
                recoveryAction ||
                this._recoveryActions.get(boundaryError.category) ||
                this._getDefaultRecoveryAction(boundaryError);

            // Attempt recovery
            const recoveryResult = await this._attemptRecovery(boundaryError, action);

            if (recoveryResult.success) {
                boundaryError.recovered = true;
                this.emit('recovery-succeeded', boundaryError.id, recoveryResult);
                this._log('info', `Successfully recovered from error ${boundaryError.id}`);
            } else {
                this.emit('recovery-failed', boundaryError.id, recoveryResult);
                this._log(
                    'error',
                    `Failed to recover from error ${boundaryError.id}`,
                    recoveryResult.error
                );

                // Apply fallback strategies
                this._applyFallbackStrategy(boundaryError);
            }

            // Clean up if needed
            if (this._errorHistory.length > this._config.maxErrors) {
                this.cleanup();
            }

            return null;
        }

        private _createBoundaryError(error: Error, context: ErrorContext): BoundaryError {
            const severity = this._determineSeverity(error, context);
            const category = this._determineCategory(error, context);
            const strategy = this._getDefaultRecoveryAction({
                severity,
                category,
            } as BoundaryError).strategy;

            return {
                id: `error_${this._nextErrorId++}_${Date.now()}`,
                original: error,
                severity,
                category,
                context: {
                    ...context,
                    stackTrace: error.stack,
                },
                recoveryStrategy: strategy,
                retryCount: 0,
                recovered: false,
            };
        }

        private _determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
            // Critical errors that could crash the extension
            if (
                error.message.includes('segmentation fault') ||
                error.message.includes('out of memory') ||
                context.phase === 'initialization'
            ) {
                return ErrorSeverity.Critical;
            }

            // High severity for component failures
            if (
                context.component &&
                (error.message.includes('failed to initialize') ||
                    error.message.includes('dependency missing'))
            ) {
                return ErrorSeverity.High;
            }

            // Medium severity for runtime issues
            if (context.phase === 'runtime' || error.name === 'TypeError') {
                return ErrorSeverity.Medium;
            }

            return ErrorSeverity.Low;
        }

        private _determineCategory(error: Error, context: ErrorContext): ErrorCategory {
            if (context.phase === 'initialization') {
                return ErrorCategory.Initialization;
            }
            if (context.operation?.includes('signal')) {
                return ErrorCategory.Signal;
            }
            if (context.operation?.includes('state')) {
                return ErrorCategory.State;
            }
            if (context.operation?.includes('effect') || context.operation?.includes('resource')) {
                return ErrorCategory.Resource;
            }
            if (context.operation?.includes('ui')) {
                return ErrorCategory.UI;
            }
            if (error.message.includes('external') || error.message.includes('dbus')) {
                return ErrorCategory.External;
            }

            return ErrorCategory.Runtime;
        }

        private async _attemptRecovery(
            error: BoundaryError,
            action: RecoveryAction
        ): Promise<RecoveryResult> {
            const startTime = Date.now();
            this.emit('recovery-attempted', error.id, action.strategy);

            let retriesUsed = 0;
            let fallbackUsed = false;
            let lastError: Error | undefined;

            while (retriesUsed < (action.maxRetries || this._config.maxRetries)) {
                try {
                    switch (action.strategy) {
                        case RecoveryStrategy.Retry:
                            if (action.retryDelay) {
                                await this._delay(action.retryDelay);
                            }
                            break;

                        case RecoveryStrategy.Restart:
                            await this._restartComponent(error.context.component);
                            break;

                        case RecoveryStrategy.Degrade:
                            this.activateDegradedMode(error.context.component!);
                            break;

                        case RecoveryStrategy.Isolate:
                            this.isolateComponent(error.context.component!);
                            break;

                        case RecoveryStrategy.Ignore:
                            return {
                                success: true,
                                strategy: action.strategy,
                                retriesUsed,
                                timeElapsed: Date.now() - startTime,
                                fallbackUsed,
                            };
                    }

                    // Check if recovery was successful
                    if (action.successCheck?.() !== false) {
                        return {
                            success: true,
                            strategy: action.strategy,
                            retriesUsed,
                            timeElapsed: Date.now() - startTime,
                            fallbackUsed,
                        };
                    }
                } catch (recoveryError) {
                    lastError = recoveryError as Error;
                    this._log('warn', `Recovery attempt ${retriesUsed + 1} failed:`, recoveryError);
                }

                retriesUsed++;
                error.retryCount = retriesUsed;
            }

            // Try fallback if available
            if (action.fallbackAction && !fallbackUsed) {
                try {
                    await action.fallbackAction();
                    fallbackUsed = true;

                    if (action.successCheck?.() !== false) {
                        return {
                            success: true,
                            strategy: action.strategy,
                            retriesUsed,
                            timeElapsed: Date.now() - startTime,
                            fallbackUsed,
                        };
                    }
                } catch (fallbackError) {
                    lastError = fallbackError as Error;
                }
            }

            return {
                success: false,
                strategy: action.strategy,
                retriesUsed,
                timeElapsed: Date.now() - startTime,
                fallbackUsed,
                error: lastError,
            };
        }

        private _applyFallbackStrategy(error: BoundaryError): void {
            // Escalate to more severe recovery strategies
            switch (error.recoveryStrategy) {
                case RecoveryStrategy.Retry:
                    if (error.severity === ErrorSeverity.Critical) {
                        this.isolateComponent(error.context.component!);
                    } else {
                        this.activateDegradedMode(error.context.component!);
                    }
                    break;

                case RecoveryStrategy.Degrade:
                    this.isolateComponent(error.context.component!);
                    break;

                case RecoveryStrategy.Restart:
                    this.isolateComponent(error.context.component!);
                    break;
            }
        }

        private _getDefaultRecoveryAction(error: BoundaryError): RecoveryAction {
            switch (error.severity) {
                case ErrorSeverity.Critical:
                    return { strategy: RecoveryStrategy.Isolate };
                case ErrorSeverity.High:
                    return { strategy: RecoveryStrategy.Restart, maxRetries: 2 };
                case ErrorSeverity.Medium:
                    return { strategy: RecoveryStrategy.Retry, maxRetries: 3, retryDelay: 1000 };
                default:
                    return { strategy: RecoveryStrategy.Ignore };
            }
        }

        private _setupDefaultRecoveryActions(): void {
            this._recoveryActions.set(ErrorCategory.Initialization, {
                strategy: RecoveryStrategy.Restart,
                maxRetries: 2,
            });

            this._recoveryActions.set(ErrorCategory.Resource, {
                strategy: RecoveryStrategy.Retry,
                maxRetries: 3,
                retryDelay: 500,
            });

            this._recoveryActions.set(ErrorCategory.Signal, {
                strategy: RecoveryStrategy.Retry,
                maxRetries: 2,
                retryDelay: 1000,
            });

            this._recoveryActions.set(ErrorCategory.UI, {
                strategy: RecoveryStrategy.Degrade,
            });

            this._recoveryActions.set(ErrorCategory.External, {
                strategy: RecoveryStrategy.Retry,
                maxRetries: 5,
                retryDelay: 2000,
            });
        }

        private _getCircuitBreaker(component: string): CircuitBreaker {
            if (!this._circuitBreakers.has(component)) {
                this._circuitBreakers.set(
                    component,
                    new CircuitBreaker(
                        this._config.circuitBreakerThreshold,
                        this._config.circuitBreakerTimeout
                    )
                );
            }
            return this._circuitBreakers.get(component)!;
        }

        private async _restartComponent(componentName?: string): Promise<void> {
            if (!componentName) {
                return;
            }

            this._log('info', `Attempting to restart component: ${componentName}`);
            // Implementation would depend on component registry integration
            // This is a placeholder for the actual restart logic
        }

        private async _delay(ms: number): Promise<void> {
            return new Promise(resolve => {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
                    resolve();
                    return GLib.SOURCE_REMOVE;
                });
            });
        }

        private _log(level: string, message: string, ...args: any[]): void {
            const prefix = '[ErrorBoundary]';

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
export type ErrorBoundary = InstanceType<typeof ErrorBoundary>;
