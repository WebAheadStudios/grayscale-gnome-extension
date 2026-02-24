/**
 * Infrastructure type definitions for advanced architectural patterns
 */

// Re-export core infrastructure types
export type {
    ComponentMetadata,
    ComponentConfig,
    ComponentState,
    LifecycleHooks,
    ComponentDependencies,
    ComponentFactory,
    ComponentRegistration,
    DependencyResolution,
    RegistryConfig,
} from '../infrastructure/index.js';

export type {
    SignalConnection,
    ConnectionOptions,
    SignalStats,
    ConnectionGroup,
} from '../infrastructure/index.js';

export type {
    EffectPoolConfig,
    EffectMetadata,
    PoolStatistics,
    EffectFactory,
} from '../infrastructure/index.js';

export type {
    ErrorContext,
    BoundaryError,
    RecoveryAction,
    ErrorHandlerConfig,
    RecoveryResult,
} from '../infrastructure/index.js';

export type {
    LogEntry,
    LoggerConfig,
    ComponentLogger,
    LogStatistics,
} from '../infrastructure/index.js';

export type {
    CacheEntry,
    CacheConfig,
    ValidationRule,
    TransformFunction,
    CacheStatistics,
} from '../infrastructure/index.js';

export type {
    PerformanceMeasurement,
    OperationTimer,
    PerformanceThreshold,
    PerformanceAlert,
    PerformanceStatistics,
    ResourceUsage,
    PerformanceReport,
    MonitorConfig,
} from '../infrastructure/index.js';

// Enhanced extension architecture types
export interface InfrastructureServices {
    logger: any;
    signalManager: any;
    errorBoundary: any;
    performanceMonitor: any;
    effectPool: any;
    configCache?: any;
    componentRegistry: any;
}

export interface InfrastructureConfig {
    logger?: {
        level?: string;
        enableConsole?: boolean;
        enableFile?: boolean;
        enableStructured?: boolean;
    };
    signalManager?: {
        enableStatistics?: boolean;
        maxConnections?: number;
    };
    errorBoundary?: {
        enableCircuitBreaker?: boolean;
        maxRetries?: number;
        enableReporting?: boolean;
    };
    performanceMonitor?: {
        enableTiming?: boolean;
        enableResourceMonitoring?: boolean;
        sampleRate?: number;
        retentionPeriod?: number;
    };
    effectPool?: {
        initialSize?: number;
        maxSize?: number;
        maxIdleTime?: number;
    };
    configCache?: {
        maxEntries?: number;
        maxAge?: number;
        enableValidation?: boolean;
    };
    componentRegistry?: {
        autoInitialize?: boolean;
        strictDependencies?: boolean;
        maxRetries?: number;
    };
}

// Enhanced component interface with infrastructure integration
export interface EnhancedExtensionComponent {
    // Core lifecycle
    enable(): void;
    disable(): void;
    destroy?(): void;

    // Infrastructure integration
    setInfrastructure?(services: Partial<InfrastructureServices>): void;
    getComponentMetadata?(): ComponentMetadata;

    // Performance monitoring
    recordPerformanceMetric?(name: string, value: number, unit: string): void;

    // Error handling
    handleError?(error: Error, context?: string): void;

    // Configuration
    updateConfiguration?(config: Record<string, any>): void;
    validateConfiguration?(config: Record<string, any>): boolean;
}

// Component factory with infrastructure support
export interface InfrastructureComponentFactory<
    T extends EnhancedExtensionComponent = EnhancedExtensionComponent,
> {
    create(
        extension: any,
        services: InfrastructureServices,
        metadata: ComponentMetadata,
        config?: ComponentConfig
    ): T;
    dependencies: string[];
    priority: number;
    infrastructureRequirements: Array<keyof InfrastructureServices>;
}

// Enhanced extension manager with infrastructure
export interface InfrastructureExtensionManager {
    readonly services: InfrastructureServices;
    readonly componentRegistry: any;
    readonly components: Map<string, EnhancedExtensionComponent>;

    // Component management
    registerComponent<T extends EnhancedExtensionComponent>(
        name: string,
        factory: InfrastructureComponentFactory<T>,
        metadata: ComponentMetadata,
        config?: ComponentConfig
    ): void;

    getComponent<T extends EnhancedExtensionComponent>(name: string): T | null;
    removeComponent(name: string): void;

    // Lifecycle with infrastructure
    initializeInfrastructure(config?: InfrastructureConfig): Promise<void>;
    destroyInfrastructure(): Promise<void>;

    // Performance and monitoring
    generatePerformanceReport(): any;
    getComponentStatistics(componentName?: string): any;

    // Error handling
    handleComponentError(componentName: string, error: Error): void;

    // Configuration management
    updateComponentConfiguration(componentName: string, config: Record<string, any>): boolean;
    validateExtensionConfiguration(config: Record<string, any>): boolean;
}
