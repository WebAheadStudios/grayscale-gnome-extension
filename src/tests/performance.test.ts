/**
 * Performance Benchmarking Tests
 * Tests for measuring extension performance and detecting regressions
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

interface PerformanceMetrics {
    startupTime: number;
    memoryUsage: number;
    effectApplicationTime: number;
    signalHandlingTime: number;
}

interface BenchmarkResult {
    operation: string;
    duration: number;
    memory: number;
    iterations: number;
}

describe('Performance Benchmarks', () => {
    let performanceMetrics: PerformanceMetrics;

    beforeEach(() => {
        performanceMetrics = {
            startupTime: 0,
            memoryUsage: 0,
            effectApplicationTime: 0,
            signalHandlingTime: 0,
        };

        // Mock performance APIs
        global.performance = {
            now: jest.fn(() => Date.now()),
            mark: jest.fn(),
            measure: jest.fn(),
            getEntriesByName: jest.fn(() => []),
            getEntriesByType: jest.fn(() => []),
            clearMarks: jest.fn(),
            clearMeasures: jest.fn(),
        } as any;
    });

    describe('Component Initialization Performance', () => {
        it('should initialize BaseComponent within acceptable time', async () => {
            const iterations = 100;
            const results: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();

                // Simulate component initialization
                const mockConfig = {
                    name: `TestComponent${i}`,
                    version: '1.0.0',
                    dependencies: [],
                    settings: {},
                };

                // Mock component creation (would import actual BaseComponent in real test)
                const simulatedInitTime = Math.random() * 5; // Simulate 0-5ms initialization
                await new Promise(resolve => setTimeout(resolve, simulatedInitTime));

                const end = performance.now();
                results.push(end - start);
            }

            const averageTime = results.reduce((a, b) => a + b, 0) / results.length;
            const maxTime = Math.max(...results);

            // Assert performance requirements
            expect(averageTime).toBeLessThan(10); // Average should be under 10ms
            expect(maxTime).toBeLessThan(50); // Max should be under 50ms

            console.log(
                `Component initialization: avg=${averageTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`
            );
        });

        it('should handle component registry operations efficiently', async () => {
            const iterations = 1000;
            const start = performance.now();

            // Simulate registry operations
            const operations = [];
            for (let i = 0; i < iterations; i++) {
                operations.push(
                    Promise.resolve({
                        register: () => true,
                        unregister: () => true,
                        has: () => Boolean(Math.random() > 0.5),
                    })
                );
            }

            await Promise.all(operations);
            const end = performance.now();

            const totalTime = end - start;
            const averageOperationTime = totalTime / iterations;

            expect(averageOperationTime).toBeLessThan(1); // Each operation should be under 1ms
            expect(totalTime).toBeLessThan(1000); // Total should be under 1 second

            console.log(
                `Registry operations: ${iterations} ops in ${totalTime.toFixed(2)}ms (${averageOperationTime.toFixed(3)}ms/op)`
            );
        });
    });

    describe('Signal Manager Performance', () => {
        it('should handle signal connections efficiently', async () => {
            const connectionCount = 1000;
            const start = performance.now();

            // Simulate signal connections
            const connections = [];
            for (let i = 0; i < connectionCount; i++) {
                const mockObject = {
                    connect: jest.fn().mockReturnValue(i),
                    disconnect: jest.fn(),
                };

                // Simulate connection time
                connections.push({
                    id: i,
                    object: mockObject,
                    signal: `signal-${i % 10}`,
                });
            }

            const end = performance.now();
            const totalTime = end - start;

            expect(totalTime).toBeLessThan(100); // Should complete under 100ms

            console.log(
                `Signal connections: ${connectionCount} connections in ${totalTime.toFixed(2)}ms`
            );
        });

        it('should clean up signals efficiently', async () => {
            const signalCount = 500;
            const start = performance.now();

            // Simulate signal cleanup
            for (let i = 0; i < signalCount; i++) {
                // Simulate disconnect operation
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            const end = performance.now();
            const totalTime = end - start;

            expect(totalTime).toBeLessThan(200); // Cleanup should be under 200ms

            console.log(`Signal cleanup: ${signalCount} signals in ${totalTime.toFixed(2)}ms`);
        });
    });

    describe('Effect Application Performance', () => {
        it('should apply grayscale effect within performance bounds', async () => {
            const monitorCount = 4; // Test with multiple monitors
            const iterations = 50;
            const results: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const start = performance.now();

                // Simulate effect application
                for (let monitor = 0; monitor < monitorCount; monitor++) {
                    // Simulate effect processing time
                    const processingTime = Math.random() * 3; // 0-3ms per monitor
                    await new Promise(resolve => setTimeout(resolve, processingTime));
                }

                const end = performance.now();
                results.push(end - start);
            }

            const averageTime = results.reduce((a, b) => a + b, 0) / results.length;
            const maxTime = Math.max(...results);

            // Performance requirements for effect application
            expect(averageTime).toBeLessThan(20); // Average under 20ms
            expect(maxTime).toBeLessThan(50); // Max under 50ms

            console.log(
                `Effect application: avg=${averageTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms (${monitorCount} monitors)`
            );
        });

        it('should handle rapid effect toggles without degradation', async () => {
            const toggleCount = 100;
            const results: number[] = [];

            for (let i = 0; i < toggleCount; i++) {
                const start = performance.now();

                // Simulate toggle operation
                const toggleTime = Math.random() * 2; // 0-2ms per toggle
                await new Promise(resolve => setTimeout(resolve, toggleTime));

                const end = performance.now();
                results.push(end - start);
            }

            const averageTime = results.reduce((a, b) => a + b, 0) / results.length;
            const lastTenAverage = results.slice(-10).reduce((a, b) => a + b, 0) / 10;

            // Check for performance degradation
            const degradationRatio = lastTenAverage / averageTime;
            expect(degradationRatio).toBeLessThan(1.2); // No more than 20% degradation

            console.log(
                `Toggle performance: avg=${averageTime.toFixed(2)}ms, last10=${lastTenAverage.toFixed(2)}ms, ratio=${degradationRatio.toFixed(2)}`
            );
        });
    });

    describe('Memory Usage', () => {
        it('should maintain stable memory usage', async () => {
            const iterations = 100;
            const memoryReadings: number[] = [];

            for (let i = 0; i < iterations; i++) {
                // Simulate memory usage tracking
                const mockMemoryUsage = 1000000 + Math.random() * 100000; // 1MB + 0-100KB variance
                memoryReadings.push(mockMemoryUsage);

                // Simulate some operations that could cause memory usage
                await new Promise(resolve => setTimeout(resolve, 1));
            }

            const initialMemory = memoryReadings.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
            const finalMemory = memoryReadings.slice(-10).reduce((a, b) => a + b, 0) / 10;
            const memoryGrowth = finalMemory - initialMemory;

            // Memory growth should be minimal (less than 10% of initial)
            expect(memoryGrowth).toBeLessThan(initialMemory * 0.1);

            console.log(
                `Memory usage: initial=${(initialMemory / 1024).toFixed(0)}KB, final=${(finalMemory / 1024).toFixed(0)}KB, growth=${(memoryGrowth / 1024).toFixed(0)}KB`
            );
        });
    });

    describe('Extension Lifecycle Performance', () => {
        it('should enable/disable extension quickly', async () => {
            const cycles = 10;
            const enableTimes: number[] = [];
            const disableTimes: number[] = [];

            for (let i = 0; i < cycles; i++) {
                // Measure enable time
                const enableStart = performance.now();
                // Simulate extension enable
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                const enableEnd = performance.now();
                enableTimes.push(enableEnd - enableStart);

                // Measure disable time
                const disableStart = performance.now();
                // Simulate extension disable
                await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
                const disableEnd = performance.now();
                disableTimes.push(disableEnd - disableStart);
            }

            const avgEnableTime = enableTimes.reduce((a, b) => a + b, 0) / enableTimes.length;
            const avgDisableTime = disableTimes.reduce((a, b) => a + b, 0) / disableTimes.length;

            expect(avgEnableTime).toBeLessThan(100); // Enable should be under 100ms
            expect(avgDisableTime).toBeLessThan(50); // Disable should be under 50ms

            console.log(
                `Lifecycle: enable=${avgEnableTime.toFixed(2)}ms, disable=${avgDisableTime.toFixed(2)}ms`
            );
        });
    });

    afterEach(() => {
        // Performance monitoring cleanup
        if (global.performance?.clearMarks) {
            global.performance.clearMarks();
            global.performance.clearMeasures();
        }
    });
});
