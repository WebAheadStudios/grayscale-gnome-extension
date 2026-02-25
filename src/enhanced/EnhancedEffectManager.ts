/**
 * EnhancedEffectManager - Demonstrates advanced architectural patterns
 * Professional implementation using BaseComponent, EffectPool, SignalManager, and ErrorBoundary
 */

import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    BaseComponent,
    ComponentMetadata,
    ComponentConfig,
    EffectPool,
    createDesaturateEffectPool,
    SignalManager,
    ErrorBoundary,
    Logger,
    PerformanceMonitor,
    LogLevel,
    LogCategory,
    ErrorCategory,
    RecoveryStrategy,
} from '../infrastructure/index.js';

import type {
    EffectConfig,
    EffectState,
    EffectChangeEvent,
    EffectManager as IEffectManager,
    EffectAnimation,
} from '../types/effects.js';
import type { MonitorInfo } from '../types/monitors.js';
import type {
    InfrastructureServices,
    EnhancedExtensionComponent,
} from '../types/infrastructure.js';

// Enhanced effect operation options
interface EnhancedEffectOptions {
    animated?: boolean;
    duration?: number;
    skipEvents?: boolean;
    force?: boolean;
    skipValidation?: boolean;
    timeout?: number;
}

// Effect application result
interface EffectApplicationResult {
    success: boolean;
    monitorIndex?: number;
    error?: Error;
    duration: number;
    fromPool: boolean;
}

// Enhanced animation settings
interface EnhancedAnimationSettings {
    duration: number;
    easing: Clutter.AnimationMode;
    enableOptimization: boolean;
    batchSize: number;
}

export class EnhancedEffectManager
    extends BaseComponent
    implements IEffectManager, EnhancedExtensionComponent
{
    static readonly METADATA: ComponentMetadata = {
        name: 'EnhancedEffectManager',
        version: '1.0.0',
        dependencies: ['StateManager', 'MonitorManager', 'SettingsController'],
    };

    private _stateManager: any = null;
    private _monitorManager: any = null;
    private _settingsController: any = null;

    // Infrastructure services
    private _effectPool: EffectPool<Clutter.DesaturateEffect>;
    private _enhancedSignalManager: SignalManager;
    private _errorBoundary: ErrorBoundary;
    private _performanceMonitor: PerformanceMonitor;

    // Enhanced state management
    private _activeEffects: Map<number, Clutter.DesaturateEffect> = new Map();
    private _animationSettings: EnhancedAnimationSettings;
    private _applicationQueue: Array<() => Promise<void>> = [];
    private _processingQueue: boolean = false;
    private _statistics = {
        totalApplications: 0,
        successfulApplications: 0,
        poolHits: 0,
        averageApplicationTime: 0,
        errorCount: 0,
    };

    constructor(extension: any, config: ComponentConfig = {}) {
        const metadata = EnhancedEffectManager.METADATA;
        super(extension, metadata, {
            enabled: true,
            autoInit: true,
            retryOnError: true,
            maxRetries: 3,
            timeout: 10000,
            ...config,
        });

        // Initialize enhanced animation settings
        this._animationSettings = {
            duration: 300,
            easing: Clutter.AnimationMode.EASE_IN_OUT,
            enableOptimization: true,
            batchSize: 5,
        };

        // Initialize infrastructure services (will be injected)
        this._effectPool = createDesaturateEffectPool({
            initialSize: 3,
            maxSize: 15,
            maxIdleTime: 300000,
            enableStatistics: true,
        });
        this._enhancedSignalManager = new SignalManager();
        this._errorBoundary = new ErrorBoundary({
            enableCircuitBreaker: true,
            maxRetries: 3,
            enableReporting: true,
        });
        this._performanceMonitor = new PerformanceMonitor({
            enableTiming: true,
            enableResourceMonitoring: true,
            sampleRate: 1.0,
        });
        this._logger = this._extension.logger || undefined;
    }

    // Infrastructure integration
    setInfrastructure(services: Partial<InfrastructureServices>): void {
        if (services.logger) {
            this._logger = services.logger.createComponentLogger(
                this.metadata.name,
                LogCategory.Component
            );
            this._effectPool.setLogger(this._logger);
            this._enhancedSignalManager.setLogger(this._logger);
            this._errorBoundary.setLogger(this._logger);
            this._performanceMonitor.setLogger(this._logger);
        }

        if (services.effectPool) {
            this._effectPool.destroy();
            this._effectPool = services.effectPool;
        }

        if (services.signalManager) {
            this._enhancedSignalManager.destroy();
            this._enhancedSignalManager = services.signalManager;
        }

        if (services.errorBoundary) {
            this._errorBoundary = services.errorBoundary;
        }

        if (services.performanceMonitor) {
            this._performanceMonitor = services.performanceMonitor;
        }
    }

    getComponentMetadata(): ComponentMetadata {
        return this.metadata;
    }

    recordPerformanceMetric(name: string, value: number, unit: string): void {
        this._performanceMonitor?.recordMeasurement({
            name,
            type: 'gauge',
            value,
            unit,
            component: this.metadata.name,
            operation: 'metric',
        } as any);
    }

    handleError(error: Error, context?: string): void {
        this._statistics.errorCount++;
        this._logger?.error('Effect manager error', { context }, error);
        this._errorBoundary?.catch(
            async () => {
                throw error;
            },
            { component: this.metadata.name, operation: context || 'unknown' }
        );
    }

    // Component lifecycle - enhanced implementation
    async onInitialize(): Promise<void> {
        this._log('info', 'Initializing EnhancedEffectManager...');

        const timerId = this._performanceMonitor?.startTimer('initialize', this.metadata.name);

        try {
            // Get dependencies with error boundary protection
            await this._errorBoundary.catch(
                async () => {
                    this._stateManager = this._extension.getComponent('StateManager');
                    this._monitorManager = this._extension.getComponent('MonitorManager');
                    this._settingsController = this._extension.getComponent('SettingsController');

                    if (!this._stateManager || !this._monitorManager) {
                        throw new Error('Required dependencies not available');
                    }
                },
                {
                    component: this.metadata.name,
                    operation: 'dependency_resolution',
                    timestamp: Date.now(),
                }
            );

            // Warm up effect pool
            this._effectPool.warmUp(5);

            // Set up error recovery
            this._setupErrorRecovery();

            // Set up performance thresholds
            this._setupPerformanceThresholds();

            this._log('info', 'EnhancedEffectManager initialized successfully');
        } catch (error) {
            this.handleError(error as Error, 'initialization');
            throw error;
        } finally {
            if (timerId) {
                this._performanceMonitor?.stopTimer(timerId);
            }
        }
    }

    onEnable(): void {
        this._log('info', 'Enabling EnhancedEffectManager...');

        try {
            this._connectSignals();
            this._log('info', 'EnhancedEffectManager enabled successfully');
        } catch (error) {
            this.handleError(error as Error, 'enable');
            throw error;
        }
    }

    onDisable(): void {
        this._log('info', 'Disabling EnhancedEffectManager...');

        try {
            this._disconnectSignals();
            this._removeAllEffects();
            this._log('info', 'EnhancedEffectManager disabled successfully');
        } catch (error) {
            this.handleError(error as Error, 'disable');
        }
    }

    onDestroy(): void {
        this._log('info', 'Destroying EnhancedEffectManager...');

        try {
            // Clean up resources
            this._effectPool.destroy();
            this._enhancedSignalManager.destroy();

            // Generate final performance report
            if (this._performanceMonitor) {
                const report = this._performanceMonitor.generateReport();
                this._log('info', 'Final performance report', report.summary);
            }

            this._activeEffects.clear();
            this._applicationQueue = [];

            this._log('info', 'EnhancedEffectManager destroyed successfully');
        } catch (error) {
            this._logger?.error('Error during destruction:', {}, error);
        }
    }

    onError(error: Error, phase: any): void {
        this._logger?.error(`Error in phase ${phase}:`, {}, error);

        // Implement graceful degradation
        if (phase === 'enabled' && this._activeEffects.size > 0) {
            this._log('warn', 'Implementing graceful degradation due to error');
            this._removeAllEffects();
        }
    }

    // Enhanced public API
    async applyGlobalEffect(
        enabled: boolean,
        options: EnhancedEffectOptions = {}
    ): Promise<boolean> {
        const operation = enabled ? 'apply_global' : 'remove_global';
        const timerId = this._performanceMonitor?.startTimer(operation, this.metadata.name);

        try {
            const result = await this._errorBoundary.catch(
                async () => {
                    return this._applyGlobalEffectInternal(enabled, options);
                },
                {
                    component: this.metadata.name,
                    operation,
                    timestamp: Date.now(),
                }
            );

            this._statistics.totalApplications++;
            if (result) {
                this._statistics.successfulApplications++;
            }

            this.recordPerformanceMetric(
                'success_rate',
                (this._statistics.successfulApplications / this._statistics.totalApplications) *
                    100,
                'percentage'
            );

            return result || false;
        } catch (error) {
            this.handleError(error as Error, operation);
            return false;
        } finally {
            if (timerId) {
                this._performanceMonitor?.stopTimer(timerId);
            }
        }
    }

    async applyMonitorEffect(
        monitorIndex: number,
        enabled: boolean,
        options: EnhancedEffectOptions = {}
    ): Promise<boolean> {
        const operation = `${enabled ? 'apply' : 'remove'}_monitor_${monitorIndex}`;
        const timerId = this._performanceMonitor?.startTimer(operation, this.metadata.name);

        try {
            const result = await this._errorBoundary.catch(
                async () => {
                    return this._applyMonitorEffectInternal(monitorIndex, enabled, options);
                },
                {
                    component: this.metadata.name,
                    operation,
                    timestamp: Date.now(),
                }
            );

            return result || false;
        } catch (error) {
            this.handleError(error as Error, operation);
            return false;
        } finally {
            if (timerId) {
                this._performanceMonitor?.stopTimer(timerId);
            }
        }
    }

    removeAllEffects(): void {
        const timerId = this._performanceMonitor?.startTimer(
            'remove_all_effects',
            this.metadata.name
        );

        try {
            this._removeAllEffects();
        } catch (error) {
            this.handleError(error as Error, 'remove_all_effects');
        } finally {
            if (timerId) {
                this._performanceMonitor?.stopTimer(timerId);
            }
        }
    }

    // Enhanced configuration management
    updateConfiguration(config: Record<string, any>): void {
        this._log('info', 'Updating configuration', config);

        if (config.animationDuration !== undefined) {
            this._animationSettings.duration = config.animationDuration;
        }

        if (config.enableOptimization !== undefined) {
            this._animationSettings.enableOptimization = config.enableOptimization;
        }

        if (config.effectPoolConfig) {
            this._effectPool.updateConfig(config.effectPoolConfig);
        }

        if (config.performanceConfig) {
            this._performanceMonitor?.updateConfig(config.performanceConfig);
        }
    }

    validateConfiguration(config: Record<string, any>): boolean {
        // Validate animation duration
        if (config.animationDuration !== undefined) {
            if (
                typeof config.animationDuration !== 'number' ||
                config.animationDuration < 0 ||
                config.animationDuration > 5000
            ) {
                this._log('warn', 'Invalid animation duration', {
                    value: config.animationDuration,
                });
                return false;
            }
        }

        // Validate optimization flag
        if (config.enableOptimization !== undefined) {
            if (typeof config.enableOptimization !== 'boolean') {
                this._log('warn', 'Invalid enableOptimization value', {
                    value: config.enableOptimization,
                });
                return false;
            }
        }

        return true;
    }

    // Enhanced inspection methods
    getStatistics(): any {
        return {
            ...this._statistics,
            poolStats: this._effectPool.getStatistics(),
            signalStats: this._enhancedSignalManager?.getStats(),
            performanceStats: this._performanceMonitor?.getStatistics(),
            activeEffects: this._activeEffects.size,
            queueLength: this._applicationQueue.length,
        };
    }

    getActiveEffects(): Map<string | number, Clutter.DesaturateEffect> {
        return new Map(this._activeEffects);
    }

    // Private enhanced implementation
    private async _applyGlobalEffectInternal(
        enabled: boolean,
        options: EnhancedEffectOptions
    ): Promise<boolean> {
        const monitors = this._monitorManager?.getMonitors() || [];
        const results: Promise<EffectApplicationResult>[] = [];

        // Process monitors in batches for better performance
        const batchSize = this._animationSettings.batchSize;
        for (let i = 0; i < monitors.length; i += batchSize) {
            const batch = monitors.slice(i, i + batchSize);

            for (const monitor of batch) {
                results.push(this._applyMonitorEffectWithResult(monitor.index, enabled, options));
            }

            // Small delay between batches if optimization is enabled
            if (this._animationSettings.enableOptimization && i + batchSize < monitors.length) {
                await this._delay(50);
            }
        }

        const allResults = await Promise.allSettled(results);
        const successful = allResults.filter(
            r => r.status === 'fulfilled' && r.value.success
        ).length;

        // Update performance metrics
        const totalTime = allResults.reduce((sum, r) => {
            return sum + (r.status === 'fulfilled' ? r.value.duration : 0);
        }, 0);

        this._statistics.averageApplicationTime =
            (this._statistics.averageApplicationTime + totalTime / allResults.length) / 2;

        this.recordPerformanceMetric(
            'batch_success_rate',
            (successful / allResults.length) * 100,
            'percentage'
        );

        return successful === monitors.length;
    }

    private async _applyMonitorEffectInternal(
        monitorIndex: number,
        enabled: boolean,
        options: EnhancedEffectOptions
    ): Promise<boolean> {
        const result = await this._applyMonitorEffectWithResult(monitorIndex, enabled, options);
        return result.success;
    }

    private async _applyMonitorEffectWithResult(
        monitorIndex: number,
        enabled: boolean,
        options: EnhancedEffectOptions
    ): Promise<EffectApplicationResult> {
        const startTime = Date.now();

        try {
            const monitor = Main.layoutManager.monitors[monitorIndex];
            if (!monitor) {
                throw new Error(`Monitor ${monitorIndex} not found`);
            }

            if (enabled) {
                await this._applyEffectToMonitor(monitorIndex, options);
            } else {
                this._removeEffectFromMonitor(monitorIndex);
            }

            const duration = Date.now() - startTime;

            return {
                success: true,
                monitorIndex,
                duration,
                fromPool: enabled, // Approximate, could track more precisely
            };
        } catch (error) {
            return {
                success: false,
                monitorIndex,
                error: error as Error,
                duration: Date.now() - startTime,
                fromPool: false,
            };
        }
    }

    private async _applyEffectToMonitor(
        monitorIndex: number,
        options: EnhancedEffectOptions
    ): Promise<void> {
        // Remove existing effect first
        this._removeEffectFromMonitor(monitorIndex);

        // Acquire effect from pool
        const effect = this._effectPool.acquire();
        this._statistics.poolHits++;

        // Apply effect to monitor
        const monitor = Main.layoutManager.monitors[monitorIndex];
        effect.set_factor(1.0);

        // Add to all actors on this monitor
        const uiGroup = Main.layoutManager.uiGroup;
        for (const actor of uiGroup.get_children()) {
            if (this._isActorOnMonitor(actor, monitorIndex)) {
                actor.add_effect(effect);
                break; // One effect per monitor
            }
        }

        this._activeEffects.set(monitorIndex, effect);

        // Animate if requested
        if (options.animated && this._animationSettings.duration > 0) {
            await this._animateEffect(effect, 0.0, 1.0, options);
        }
    }

    private _removeEffectFromMonitor(monitorIndex: number): void {
        const effect = this._activeEffects.get(monitorIndex);
        if (!effect) {
            return;
        }

        // Remove from actor
        const actor = effect.get_actor();
        if (actor) {
            actor.remove_effect(effect);
        }

        // Return to pool
        this._effectPool.release(effect);
        this._activeEffects.delete(monitorIndex);
    }

    private _removeAllEffects(): void {
        for (const monitorIndex of this._activeEffects.keys()) {
            this._removeEffectFromMonitor(monitorIndex);
        }
    }

    private async _animateEffect(
        effect: Clutter.DesaturateEffect,
        fromFactor: number,
        toFactor: number,
        options: EnhancedEffectOptions
    ): Promise<void> {
        return new Promise(resolve => {
            effect.set_factor(fromFactor);

            const transition = new Clutter.PropertyTransition({
                property_name: 'factor',
                duration: options.duration || this._animationSettings.duration,
                progress_mode: this._animationSettings.easing,
            });

            transition.set_from(fromFactor);
            transition.set_to(toFactor);

            transition.connect('completed', () => {
                resolve();
            });

            const actor = effect.get_actor();
            if (actor) {
                actor.add_transition('desaturate', transition);
            } else {
                resolve();
            }
        });
    }

    private _isActorOnMonitor(actor: any, monitorIndex: number): boolean {
        if (!actor.get_transformed_position || !actor.get_transformed_size) {
            return false;
        }

        const [x, y] = actor.get_transformed_position();
        const [width, height] = actor.get_transformed_size();
        const monitor = Main.layoutManager.monitors[monitorIndex];

        return (
            x >= monitor.x &&
            x < monitor.x + monitor.width &&
            y >= monitor.y &&
            y < monitor.y + monitor.height
        );
    }

    private _connectSignals(): void {
        this._log('debug', 'Connecting signals with enhanced signal manager');

        // Connect with enhanced signal management
        this._enhancedSignalManager.connectSignal(
            this._stateManager,
            'state-changed',
            this._onStateChanged.bind(this),
            {
                namespace: this.metadata.name,
                debounce: 100, // Debounce rapid state changes
            }
        );

        this._enhancedSignalManager.connectSignal(
            this._monitorManager,
            'monitors-changed',
            this._onMonitorsChanged.bind(this),
            {
                namespace: this.metadata.name,
                throttle: 500, // Throttle monitor change events
            }
        );

        if (this._settingsController) {
            this._enhancedSignalManager.connectSignal(
                this._settingsController,
                'setting-changed',
                this._onSettingChanged.bind(this),
                {
                    namespace: this.metadata.name,
                }
            );
        }
    }

    private _disconnectSignals(): void {
        this._log('debug', 'Disconnecting signals');
        this._enhancedSignalManager.disconnectByNamespace(this.metadata.name);
    }

    private _onStateChanged(manager: any, enabled: boolean, previous: boolean, options: any): void {
        this._log('debug', 'State changed', { enabled, previous });
        this.applyGlobalEffect(enabled, { animated: options?.animated || true });
    }

    private _onMonitorsChanged(): void {
        this._log('debug', 'Monitors changed - reapplying effects');
        this._removeAllEffects();

        const state = this._stateManager?.getGlobalState();
        if (state?.enabled) {
            this.applyGlobalEffect(true, { animated: false });
        }
    }

    private _onSettingChanged(controller: any, key: string, value: any): void {
        this._log('debug', 'Setting changed', { key, value });

        if (key === 'animation-duration') {
            this._animationSettings.duration = value;
        }
    }

    private _setupErrorRecovery(): void {
        this._errorBoundary.setRecoveryAction(ErrorCategory.Resource, {
            strategy: RecoveryStrategy.Retry,
            maxRetries: 2,
            retryDelay: 1000,
            fallbackAction: async () => {
                this._log('warn', 'Applying fallback recovery - recreating effect pool');
                this._effectPool.destroy();
                this._effectPool = createDesaturateEffectPool();
            },
        });

        this._errorBoundary.setRecoveryAction(ErrorCategory.State, {
            strategy: RecoveryStrategy.Degrade,
            fallbackAction: async () => {
                this._log('warn', 'Graceful degradation - disabling animations');
                this._animationSettings.duration = 0;
            },
        });
    }

    private _setupPerformanceThresholds(): void {
        this._performanceMonitor?.addThreshold({
            metric: 'apply_global_duration',
            component: this.metadata.name,
            warning: 1000, // 1 second
            critical: 3000, // 3 seconds
            unit: 'ms',
            enabled: true,
        });

        this._performanceMonitor?.addThreshold({
            metric: 'success_rate',
            component: this.metadata.name,
            warning: 90, // 90%
            critical: 75, // 75%
            unit: 'percentage',
            enabled: true,
        });
    }

    private async _delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    protected _log(level: string, message: string, data?: any): void {
        if (this._logger) {
            switch (level) {
                case 'debug':
                    this._logger.debug(message, data);
                    break;
                case 'info':
                    this._logger.info(message, data);
                    break;
                case 'warn':
                    this._logger.warn(message, data);
                    break;
                case 'error':
                    this._logger.error(message, data);
                    break;
                default:
                    this._logger.info(message, data);
            }
        } else {
            const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
            console[method](`[${this.metadata.name}] ${message}`, data || '');
        }
    }

    // Legacy compatibility interface implementations
    get effects(): Map<number, EffectState> {
        const effectStates: Map<number, EffectState> = new Map();

        for (const monitorIndex of this._activeEffects.keys()) {
            effectStates.set(monitorIndex, {
                isActive: true,
                config: this.getEffectConfig(),
                monitorIndex,
            });
        }

        return effectStates;
    }

    async applyEffect(monitor: MonitorInfo, config: EffectConfig): Promise<void> {
        await this.applyMonitorEffect(monitor.index, true, {
            animated: config.animationDuration > 0,
            duration: config.animationDuration,
        });
    }

    async removeEffect(monitorIndex: number): Promise<void> {
        await this.applyMonitorEffect(monitorIndex, false);
    }

    async updateEffect(monitorIndex: number, config: Partial<EffectConfig>): Promise<void> {
        this.updateEffectConfig(config);

        if (this._activeEffects.has(monitorIndex)) {
            await this.applyMonitorEffect(monitorIndex, true, {
                animated: config.animationDuration !== undefined && config.animationDuration > 0,
                duration: config.animationDuration,
            });
        }
    }

    async toggleEffect(monitorIndex: number, _config?: EffectConfig): Promise<void> {
        const isActive = this.isEffectActive(monitorIndex);
        await this.applyMonitorEffect(monitorIndex, !isActive);
    }

    initialize(): Promise<boolean> {
        return super.initialize();
    }

    async toggleGlobalEffect(enabled?: boolean, options?: any): Promise<boolean> {
        const currentState = this._stateManager?.getGlobalState()?.enabled || false;
        const targetEnabled = enabled !== undefined ? enabled : !currentState;
        return this.applyGlobalEffect(targetEnabled, options);
    }

    async toggleMonitorEffect(
        monitorIndex: number,
        enabled?: boolean,
        options?: any
    ): Promise<boolean> {
        const currentState = this._stateManager?.getMonitorState(monitorIndex)?.enabled || false;
        const targetEnabled = enabled !== undefined ? enabled : !currentState;
        return this.applyMonitorEffect(monitorIndex, targetEnabled, options);
    }

    isEffectActive(monitorIndex?: number): boolean {
        if (monitorIndex !== undefined) {
            return this._activeEffects.has(monitorIndex);
        }
        return this._activeEffects.size > 0;
    }

    getEffectConfig(): EffectConfig {
        return {
            desaturation: 1.0,
            animationDuration: this._animationSettings.duration,
            easing: this._animationSettings.easing,
        };
    }

    updateEffectConfig(config: Partial<EffectConfig>): void {
        this.updateConfiguration(config);
    }
}
