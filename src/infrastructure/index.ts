/**
 * Infrastructure Module Exports
 * Professional architectural components for GNOME Shell extensions
 */

// Base infrastructure
export {
    BaseComponent,
    ComponentPhase,
    type ComponentMetadata,
    type ComponentConfig,
    type ComponentState,
    type LifecycleHooks,
    type ComponentDependencies,
} from './BaseComponent.js';

export {
    ComponentRegistry,
    type ComponentFactory,
    type ComponentRegistration,
    type DependencyResolution,
    type RegistryConfig,
    type RegistryEvents,
} from './ComponentRegistry.js';

// Signal management
export {
    SignalManager,
    type SignalConnection,
    type ConnectionOptions,
    type SignalStats,
    type ConnectionGroup,
    type SignalManagerEvents,
} from './SignalManager.js';

// Resource management
export {
    EffectPool,
    DesaturateEffectFactory,
    createDesaturateEffectPool,
    type EffectPoolConfig,
    type EffectMetadata,
    type PoolStatistics,
    type EffectFactory,
} from './EffectPool.js';

// Error handling
export {
    ErrorBoundary,
    ErrorSeverity,
    ErrorCategory,
    RecoveryStrategy,
    type ErrorContext,
    type BoundaryError,
    type RecoveryAction,
    type ErrorHandlerConfig,
    type RecoveryResult,
} from './ErrorBoundary.js';

// Logging
export {
    Logger,
    LogLevel,
    LogCategory,
    createLogger,
    getLogger,
    type LogEntry,
    type LoggerConfig,
    type ComponentLogger,
    type LogStatistics,
} from './Logger.js';

// Configuration caching
export {
    ConfigCache,
    type CacheEntry,
    type CacheConfig,
    type ValidationRule,
    type TransformFunction,
    type CacheStatistics,
    type SchemaInfo,
    type SettingChange,
} from './ConfigCache.js';

// Performance monitoring
export {
    PerformanceMonitor,
    MetricType,
    type PerformanceMeasurement,
    type OperationTimer,
    type PerformanceThreshold,
    type PerformanceAlert,
    type PerformanceStatistics,
    type ResourceUsage,
    type PerformanceReport,
    type MonitorConfig,
} from './PerformanceMonitor.js';

// Import classes and types for utility functions
import { BaseComponent, type ComponentMetadata, type ComponentConfig } from './BaseComponent.js';
import { SignalManager } from './SignalManager.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import { createLogger } from './Logger.js';
import { ConfigCache } from './ConfigCache.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import { createDesaturateEffectPool } from './EffectPool.js';
import { type ComponentFactory } from './ComponentRegistry.js';

// Utility functions
export function createInfrastructureServices(config: {
    logger?: any;
    settings?: any;
    errorHandlerConfig?: any;
    performanceConfig?: any;
}) {
    // Create core services
    const logger = config.logger || createLogger();
    const signalManager = new SignalManager();
    const errorBoundary = new ErrorBoundary(config.errorHandlerConfig);
    const performanceMonitor = new PerformanceMonitor(config.performanceConfig);

    // Create resource managers
    const effectPool = createDesaturateEffectPool();
    const configCache = config.settings ? new ConfigCache(config.settings) : null;

    // Set up cross-dependencies
    signalManager.setLogger(logger);
    errorBoundary.setLogger(logger);
    performanceMonitor.setLogger(logger);
    effectPool.setLogger(logger);
    if (configCache) {
        configCache.setLogger(logger);
    }

    return {
        logger,
        signalManager,
        errorBoundary,
        performanceMonitor,
        effectPool,
        configCache,
    };
}

// Component factory helper
export function createComponentFactory<T extends BaseComponent>(
    componentClass: new (
        extension: any,
        metadata: ComponentMetadata,
        config?: ComponentConfig
    ) => T,
    dependencies: string[] = [],
    priority = 0
): ComponentFactory<T> {
    return {
        create: (extension: any, metadata: ComponentMetadata, config?: ComponentConfig) => {
            return new componentClass(extension, metadata, config);
        },
        dependencies,
        priority,
    };
}
