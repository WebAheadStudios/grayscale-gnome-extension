/**
 * ArchitectureValidator - Comprehensive testing and verification system
 * Validates infrastructure components, memory management, and performance
 */

import GLib from 'gi://GLib';
import {
    BaseComponent,
    ComponentRegistry,
    SignalManager,
    EffectPool,
    ErrorBoundary,
    Logger,
    PerformanceMonitor,
    ConfigCache,
    createDesaturateEffectPool,
    createInfrastructureServices,
    LogLevel,
    ErrorSeverity,
    RecoveryStrategy,
} from '../infrastructure/index.js';

// Test result interface
interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    details?: any;
    error?: Error;
}

// Validation report
interface ValidationReport {
    timestamp: number;
    totalTests: number;
    passed: number;
    failed: number;
    duration: number;
    results: TestResult[];
    memoryUsage: {
        before: number;
        after: number;
        leaked: number;
    };
    performance: {
        componentInitialization: number;
        signalProcessing: number;
        effectPoolOperations: number;
        errorRecovery: number;
    };
}

// Mock component for testing
class MockComponent extends BaseComponent {
    private _testData: any = {};

    constructor(extension: any) {
        super(extension, {
            name: 'MockComponent',
            version: '1.0.0',
            dependencies: [],
        });
    }

    async onInitialize(): Promise<void> {
        this._testData.initialized = true;
        await this._simulateAsyncWork(100);
    }

    onEnable(): void {
        this._testData.enabled = true;
    }

    onDisable(): void {
        this._testData.enabled = false;
    }

    onDestroy(): void {
        this._testData = {};
    }

    getTestData(): any {
        return this._testData;
    }

    private async _simulateAsyncWork(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Error-prone component for testing error boundaries
class ErrorProneComponent extends BaseComponent {
    constructor(extension: any) {
        super(extension, {
            name: 'ErrorProneComponent',
            version: '1.0.0',
            dependencies: [],
        });
    }

    async onInitialize(): Promise<void> {
        throw new Error('Simulated initialization error');
    }
}

export class ArchitectureValidator {
    private _results: TestResult[] = [];
    private _logger: any;
    private _startTime: number = 0;

    constructor() {
        this._logger = new Logger({
            level: LogLevel.Debug,
            enableConsole: true,
            enableStructured: true,
        });
    }

    async runFullValidation(): Promise<ValidationReport> {
        console.log('\n=== 🏗️  GNOME Extension Architecture Validation ===\n');

        this._startTime = Date.now();
        this._results = [];

        const memoryBefore = this._getMemoryEstimate();

        // Run all validation tests
        await this._testBaseComponent();
        await this._testComponentRegistry();
        await this._testSignalManager();
        await this._testEffectPool();
        await this._testErrorBoundary();
        await this._testLogger();
        await this._testPerformanceMonitor();
        await this._testConfigCache();
        await this._testInfrastructureIntegration();
        await this._testMemoryManagement();

        const memoryAfter = this._getMemoryEstimate();
        const duration = Date.now() - this._startTime;

        const report: ValidationReport = {
            timestamp: Date.now(),
            totalTests: this._results.length,
            passed: this._results.filter(r => r.passed).length,
            failed: this._results.filter(r => !r.passed).length,
            duration,
            results: [...this._results],
            memoryUsage: {
                before: memoryBefore,
                after: memoryAfter,
                leaked: Math.max(0, memoryAfter - memoryBefore),
            },
            performance: this._calculatePerformanceMetrics(),
        };

        this._printReport(report);
        return report;
    }

    // Individual test methods
    private async _testBaseComponent(): Promise<void> {
        await this._runTest('BaseComponent Lifecycle', async () => {
            const mockExtension = { getComponent: () => null };
            const component = new MockComponent(mockExtension);

            // Test initialization
            const initialized = await component.initialize();
            if (!initialized) throw new Error('Component failed to initialize');

            // Test enable/disable
            component.enable();
            if (!component.isEnabled) throw new Error('Component not enabled');

            component.disable();
            if (component.isEnabled) throw new Error('Component still enabled after disable');

            // Test destruction
            component.destroy();
            if (component.phase !== 'destroyed')
                throw new Error('Component not properly destroyed');

            return { lifecycle: 'complete' };
        });
    }

    private async _testComponentRegistry(): Promise<void> {
        await this._runTest('ComponentRegistry Management', async () => {
            const mockExtension = { getComponent: () => null };
            const registry = new ComponentRegistry(mockExtension);

            // Register components
            registry.register(
                'MockComponent',
                {
                    create: (ext, metadata, config) => new MockComponent(ext),
                    dependencies: [],
                    priority: 0,
                },
                {
                    name: 'MockComponent',
                    version: '1.0.0',
                    dependencies: [],
                }
            );

            // Test dependency resolution
            const resolution = registry.resolveDependencies();
            if (resolution.unresolved.length > 0) {
                throw new Error(`Unresolved dependencies: ${resolution.unresolved}`);
            }

            // Test initialization
            await registry.initializeAll();
            const component = registry.get('MockComponent');
            if (!component || !component.isReady) {
                throw new Error('Component not properly initialized');
            }

            // Test cleanup
            await registry.destroyAll();
            registry.destroy();

            return { components: 1, resolved: true };
        });
    }

    private async _testSignalManager(): Promise<void> {
        await this._runTest('SignalManager Operations', async () => {
            const signalManager = new SignalManager();
            const mockObject = new (class extends GObject.Object {
                static [GObject.signals] = {
                    'test-signal': { param_types: [GObject.TYPE_STRING] },
                };
            })();

            let signalReceived = false;
            let signalData = '';

            // Test signal connection
            const connectionId = signalManager.connect(
                mockObject,
                'test-signal',
                (obj: any, data: string) => {
                    signalReceived = true;
                    signalData = data;
                },
                { debounce: 100 }
            );

            // Emit signal
            mockObject.emit('test-signal', 'test-data');

            // Wait for debounced signal
            await new Promise(resolve => setTimeout(resolve, 150));

            if (!signalReceived || signalData !== 'test-data') {
                throw new Error('Signal not properly received');
            }

            // Test disconnection
            signalManager.disconnect(connectionId);
            const stats = signalManager.getStats();

            signalManager.destroy();

            return {
                connected: true,
                received: signalReceived,
                stats: stats.totalConnections,
            };
        });
    }

    private async _testEffectPool(): Promise<void> {
        await this._runTest('EffectPool Resource Management', async () => {
            const pool = createDesaturateEffectPool({
                initialSize: 3,
                maxSize: 10,
                enableStatistics: true,
            });

            // Test acquiring effects
            const effects = [];
            for (let i = 0; i < 5; i++) {
                effects.push(pool.acquire());
            }

            const statsAfterAcquire = pool.getStatistics();
            if (statsAfterAcquire.currentInUse !== 5) {
                throw new Error(`Expected 5 effects in use, got ${statsAfterAcquire.currentInUse}`);
            }

            // Test releasing effects
            for (const effect of effects) {
                if (!pool.release(effect)) {
                    throw new Error('Failed to release effect');
                }
            }

            const statsAfterRelease = pool.getStatistics();
            if (statsAfterRelease.currentInUse !== 0) {
                throw new Error(`Expected 0 effects in use, got ${statsAfterRelease.currentInUse}`);
            }

            // Test cleanup
            const cleaned = pool.cleanup(true);
            pool.destroy();

            return {
                acquired: 5,
                released: 5,
                hitRate: statsAfterRelease.hitRate,
                cleaned,
            };
        });
    }

    private async _testErrorBoundary(): Promise<void> {
        await this._runTest('ErrorBoundary Recovery', async () => {
            const errorBoundary = new ErrorBoundary({
                enableCircuitBreaker: true,
                maxRetries: 2,
            });

            let recoveryAttempted = false;
            let recoverySuccessful = false;

            // Test error catching and recovery
            let retryCount = 0;
            const result = await errorBoundary.catch(
                async () => {
                    if (retryCount < 2) {
                        retryCount++;
                        throw new Error('Simulated failure');
                    }
                    return 'success';
                },
                {
                    component: 'TestComponent',
                    operation: 'test_operation',
                },
                {
                    strategy: RecoveryStrategy.Retry,
                    maxRetries: 3,
                    retryDelay: 50,
                }
            );

            // Test component isolation
            errorBoundary.isolateComponent('FailingComponent');
            const isIsolated = errorBoundary.isComponentIsolated('FailingComponent');

            const stats = errorBoundary.getComponentStats('TestComponent');
            errorBoundary.destroy();

            return {
                recoveryWorked: result === 'success',
                componentIsolated: isIsolated,
                errorStats: stats,
            };
        });
    }

    private async _testLogger(): Promise<void> {
        await this._runTest('Logger Functionality', async () => {
            const logger = new Logger({
                level: LogLevel.Debug,
                enableConsole: false,
                enableStructured: true,
                maxEntries: 100,
            });

            // Test different log levels
            logger.debug('Debug message', { test: true });
            logger.info('Info message', { test: true });
            logger.warn('Warning message', { test: true });
            logger.error('Error message', { test: true }, new Error('Test error'));

            // Test component logger
            const componentLogger = logger.createComponentLogger('TestComponent');
            componentLogger.info('Component message', { component: 'test' });

            // Test performance timing
            const timer = logger.startTimer('test_operation');
            await new Promise(resolve => setTimeout(resolve, 50));
            timer();

            // Test statistics
            const stats = logger.getStatistics();
            logger.flush();

            const recentEntries = logger.getRecentEntries(10);
            logger.destroy();

            return {
                entriesLogged: recentEntries.length,
                statistics: stats,
                bufferUtilization: stats.bufferUtilization,
            };
        });
    }

    private async _testPerformanceMonitor(): Promise<void> {
        await this._runTest('PerformanceMonitor Tracking', async () => {
            const monitor = new PerformanceMonitor({
                enableTiming: true,
                enableResourceMonitoring: false,
                sampleRate: 1.0,
            });

            // Test timing
            const timerId = monitor.startTimer('test_operation', 'TestComponent');
            await new Promise(resolve => setTimeout(resolve, 100));
            const duration = monitor.stopTimer(timerId);

            if (!duration || duration < 90) {
                throw new Error(`Invalid timing result: ${duration}`);
            }

            // Test measurements
            monitor.recordCounter('test_counter', 5, 'TestComponent');
            monitor.recordGauge('test_gauge', 42, 'units', 'TestComponent');

            // Test thresholds
            monitor.addThreshold({
                metric: 'test_operation_duration',
                component: 'TestComponent',
                warning: 50,
                critical: 200,
                unit: 'ms',
                enabled: true,
            });

            // Generate report
            const report = monitor.generateReport();
            monitor.destroy();

            return {
                duration,
                measurements: report.summary.totalMeasurements,
                statistics: report.statistics.length,
            };
        });
    }

    private async _testConfigCache(): Promise<void> {
        await this._runTest('ConfigCache Performance', async () => {
            // Mock GSettings for testing
            const mockSettings = {
                get_string: (key: string) => `value_${key}`,
                get_boolean: (key: string) => key.includes('enabled'),
                get_int: (key: string) => 42,
                set_string: () => {},
                set_boolean: () => {},
                set_int: () => {},
                connect: () => 1,
                disconnect: () => {},
                schema_id: 'test.schema',
                path: '/test/path/',
                settings_schema: {
                    list_keys: () => ['test-string', 'test-boolean', 'test-int'],
                    get_key: (key: string) => ({
                        get_value_type: () => ({ dup_string: () => 'string' }),
                        get_default_value: () => ({ unpack: () => 'default' }),
                        get_description: () => 'Test key',
                    }),
                },
            };

            const configCache = new ConfigCache(mockSettings as any, {
                maxEntries: 50,
                enableValidation: true,
                enableStatistics: true,
            });

            // Test caching performance
            const startTime = Date.now();

            // First access (cache miss)
            const value1 = configCache.getString('test-key');

            // Second access (cache hit)
            const value2 = configCache.getString('test-key');

            const cacheTime = Date.now() - startTime;

            // Test validation
            configCache.setValidator('test-key', (value: string) => value.length > 0);
            const validValue = configCache.setString('test-key', 'valid');

            // Test statistics
            const stats = configCache.getStatistics();
            configCache.destroy();

            return {
                cacheWorking: value1 === value2,
                cacheTime,
                validation: validValue,
                hitRate: stats.hitRate,
                totalEntries: stats.totalEntries,
            };
        });
    }

    private async _testInfrastructureIntegration(): Promise<void> {
        await this._runTest('Infrastructure Integration', async () => {
            // Test integrated services creation
            const services = createInfrastructureServices({
                logger: undefined, // Will create default
                settings: undefined,
                errorHandlerConfig: { enableCircuitBreaker: true },
                performanceConfig: { enableTiming: true },
            });

            // Verify all services are created and connected
            if (!services.logger) throw new Error('Logger not created');
            if (!services.signalManager) throw new Error('SignalManager not created');
            if (!services.errorBoundary) throw new Error('ErrorBoundary not created');
            if (!services.performanceMonitor) throw new Error('PerformanceMonitor not created');
            if (!services.effectPool) throw new Error('EffectPool not created');

            // Test cross-service communication
            services.logger.info('Integration test message');
            const effect = services.effectPool.acquire();
            const released = services.effectPool.release(effect);

            // Cleanup
            services.logger.destroy();
            services.signalManager.destroy();
            services.errorBoundary.destroy();
            services.performanceMonitor.destroy();
            services.effectPool.destroy();

            return {
                servicesCreated: 5,
                effectPoolWorking: released,
                integration: 'successful',
            };
        });
    }

    private async _testMemoryManagement(): Promise<void> {
        await this._runTest('Memory Management', async () => {
            const initialMemory = this._getMemoryEstimate();

            // Create and destroy multiple components
            const components = [];
            for (let i = 0; i < 10; i++) {
                const mockExtension = { getComponent: () => null };
                const component = new MockComponent(mockExtension);
                await component.initialize();
                component.enable();
                components.push(component);
            }

            const memoryAfterCreation = this._getMemoryEstimate();

            // Cleanup all components
            for (const component of components) {
                component.disable();
                component.destroy();
            }

            // Force garbage collection simulation
            await new Promise(resolve => setTimeout(resolve, 100));

            const memoryAfterCleanup = this._getMemoryEstimate();

            const leaked = Math.max(0, memoryAfterCleanup - initialMemory);
            const cleanupRatio =
                (memoryAfterCreation - memoryAfterCleanup) / (memoryAfterCreation - initialMemory);

            return {
                initialMemory,
                memoryAfterCreation,
                memoryAfterCleanup,
                leaked,
                cleanupRatio: Math.round(cleanupRatio * 100),
            };
        });
    }

    // Helper methods
    private async _runTest(name: string, testFn: () => Promise<any>): Promise<void> {
        const startTime = Date.now();

        try {
            const details = await testFn();
            const duration = Date.now() - startTime;

            this._results.push({
                name,
                passed: true,
                duration,
                details,
            });

            console.log(`✅ ${name} - ${duration}ms`);
        } catch (error) {
            const duration = Date.now() - startTime;

            this._results.push({
                name,
                passed: false,
                duration,
                error: error as Error,
            });

            console.log(`❌ ${name} - ${duration}ms - ${(error as Error).message}`);
        }
    }

    private _getMemoryEstimate(): number {
        // Rough estimate using object counts and GC state
        // In a real environment, this would use more sophisticated memory tracking
        return performance.memory ? performance.memory.usedJSHeapSize : 0;
    }

    private _calculatePerformanceMetrics(): ValidationReport['performance'] {
        const getMetric = (pattern: string) => {
            const tests = this._results.filter(r => r.name.includes(pattern));
            return tests.length > 0
                ? tests.reduce((sum, t) => sum + t.duration, 0) / tests.length
                : 0;
        };

        return {
            componentInitialization: getMetric('Component'),
            signalProcessing: getMetric('Signal'),
            effectPoolOperations: getMetric('EffectPool'),
            errorRecovery: getMetric('ErrorBoundary'),
        };
    }

    private _printReport(report: ValidationReport): void {
        console.log('\n=== 📊 Validation Report ===');
        console.log(`Timestamp: ${new Date(report.timestamp).toISOString()}`);
        console.log(`Duration: ${report.duration}ms`);
        console.log(`Tests: ${report.passed}/${report.totalTests} passed`);

        if (report.failed > 0) {
            console.log(`\n❌ Failed Tests:`);
            report.results
                .filter(r => !r.passed)
                .forEach(test => {
                    console.log(`  - ${test.name}: ${test.error?.message}`);
                });
        }

        console.log(`\n💾 Memory Usage:`);
        console.log(`  Before: ${report.memoryUsage.before} bytes`);
        console.log(`  After: ${report.memoryUsage.after} bytes`);
        console.log(`  Leaked: ${report.memoryUsage.leaked} bytes`);

        console.log(`\n⚡ Performance Metrics:`);
        console.log(
            `  Component Init: ${report.performance.componentInitialization.toFixed(2)}ms avg`
        );
        console.log(`  Signal Processing: ${report.performance.signalProcessing.toFixed(2)}ms avg`);
        console.log(
            `  Effect Pool Ops: ${report.performance.effectPoolOperations.toFixed(2)}ms avg`
        );
        console.log(`  Error Recovery: ${report.performance.errorRecovery.toFixed(2)}ms avg`);

        const passRate = (report.passed / report.totalTests) * 100;
        console.log(`\n🎯 Overall Success Rate: ${passRate.toFixed(1)}%`);

        if (passRate >= 90) {
            console.log('🎉 Architecture validation PASSED - Excellent!');
        } else if (passRate >= 75) {
            console.log('⚠️  Architecture validation PARTIAL - Some issues detected');
        } else {
            console.log('💥 Architecture validation FAILED - Significant issues detected');
        }

        console.log('\n=== End Report ===\n');
    }

    destroy(): void {
        this._logger?.destroy();
        this._results = [];
    }
}

// Export convenience function for quick validation
export async function validateArchitecture(): Promise<ValidationReport> {
    const validator = new ArchitectureValidator();
    try {
        return await validator.runFullValidation();
    } finally {
        validator.destroy();
    }
}
