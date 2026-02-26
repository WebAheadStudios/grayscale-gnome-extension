/**
 * PerformanceMonitor - Comprehensive performance tracking and optimization analysis
 * Monitors timing, resource usage, and provides optimization recommendations
 */

import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

// Performance metric types
export enum MetricType {
    Timing = 'timing',
    Counter = 'counter',
    Gauge = 'gauge',
    Histogram = 'histogram',
    Rate = 'rate',
}

// Performance measurement
export interface PerformanceMeasurement {
    id: string;
    name: string;
    type: MetricType;
    value: number;
    unit: string;
    timestamp: number;
    component: string;
    operation: string;
    tags: Record<string, string>;
    metadata?: Record<string, any>;
}

// Operation timer
export interface OperationTimer {
    id: string;
    operation: string;
    component: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    tags: Record<string, string>;
    active: boolean;
}

// Performance threshold
export interface PerformanceThreshold {
    metric: string;
    component?: string;
    operation?: string;
    warning: number;
    critical: number;
    unit: string;
    enabled: boolean;
}

// Performance alert
export interface PerformanceAlert {
    id: string;
    level: 'warning' | 'critical';
    metric: string;
    threshold: PerformanceThreshold;
    measurement: PerformanceMeasurement;
    timestamp: number;
    acknowledged: boolean;
}

// Performance statistics
export interface PerformanceStatistics {
    component: string;
    operation?: string;
    measurement: {
        count: number;
        min: number;
        max: number;
        mean: number;
        median: number;
        p95: number;
        p99: number;
        stddev: number;
    };
    timeRange: {
        start: number;
        end: number;
    };
}

// Resource usage
export interface ResourceUsage {
    timestamp: number;
    memory: {
        used: number;
        available: number;
        percentage: number;
    };
    cpu: {
        percentage: number;
        loadAverage: number[];
    };
    io: {
        reads: number;
        writes: number;
        bytesRead: number;
        bytesWritten: number;
    };
}

// Performance report
export interface PerformanceReport {
    timeRange: { start: number; end: number };
    summary: {
        totalMeasurements: number;
        componentsAnalyzed: number;
        alertsGenerated: number;
        averageResponseTime: number;
        slowestOperations: Array<{ component: string; operation: string; avgDuration: number }>;
        resourceUtilization: { cpu: number; memory: number };
    };
    recommendations: string[];
    statistics: PerformanceStatistics[];
    alerts: PerformanceAlert[];
}

// Monitor configuration
export interface MonitorConfig {
    enableTiming?: boolean;
    enableResourceMonitoring?: boolean;
    enableAlerts?: boolean;
    sampleRate?: number; // 0.0 to 1.0
    retentionPeriod?: number; // milliseconds
    maxMeasurements?: number;
    reportInterval?: number; // milliseconds
    thresholds?: PerformanceThreshold[];
    enableRecommendations?: boolean;
}

export const PerformanceMonitor = GObject.registerClass(
    {
        GTypeName: 'GrayscalePerformanceMonitor',
        Signals: {
            'measurement-recorded': {
                param_types: [GObject.TYPE_JSOBJECT], // PerformanceMeasurement
            },
            'threshold-exceeded': {
                param_types: [GObject.TYPE_JSOBJECT, GObject.TYPE_STRING], // PerformanceAlert, level
            },
            'report-generated': {
                param_types: [GObject.TYPE_JSOBJECT], // PerformanceReport
            },
            'resource-usage-updated': {
                param_types: [GObject.TYPE_JSOBJECT], // ResourceUsage
            },
            'recommendation-available': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_JSOBJECT], // recommendation, data
            },
        },
    },
    class PerformanceMonitor extends GObject.Object {
        private _config: Required<MonitorConfig>;
        private _measurements: Map<string, PerformanceMeasurement[]> = new Map();
        private _timers: Map<string, OperationTimer> = new Map();
        private _thresholds: Map<string, PerformanceThreshold> = new Map();
        private _alerts: PerformanceAlert[] = [];
        private _resourceHistory: ResourceUsage[] = [];
        private _statistics: Map<string, PerformanceStatistics> = new Map();
        private _nextMeasurementId = 1;
        private _nextTimerId = 1;
        private _nextAlertId = 1;
        private _reportTimeoutId: number | null = null;
        private _resourceMonitorTimeoutId: number | null = null;
        private _logger: any = null;
        private _destroyed = false;

        constructor(config: MonitorConfig = {}) {
            super();

            this._config = {
                enableTiming: true,
                enableResourceMonitoring: true,
                enableAlerts: true,
                sampleRate: 1.0,
                retentionPeriod: 3600000, // 1 hour
                maxMeasurements: 10000,
                reportInterval: 300000, // 5 minutes
                thresholds: [],
                enableRecommendations: true,
                ...config,
            };

            this._initialize();
        }

        // Public API - Timing
        startTimer(
            operation: string,
            component = 'unknown',
            tags: Record<string, string> = {}
        ): string {
            if (!this._config.enableTiming || !this._shouldSample()) {
                return '';
            }

            const timerId = `timer_${this._nextTimerId++}_${Date.now()}`;
            const timer: OperationTimer = {
                id: timerId,
                operation,
                component,
                startTime: this._getHighResolutionTime(),
                tags,
                active: true,
            };

            this._timers.set(timerId, timer);
            this._log('debug', `Started timer for ${component}.${operation}`, { timerId });

            return timerId;
        }

        stopTimer(timerId: string): number | null {
            if (!timerId || !this._timers.has(timerId)) {
                return null;
            }

            const timer = this._timers.get(timerId)!;
            if (!timer.active) {
                return null;
            }

            timer.endTime = this._getHighResolutionTime();
            timer.duration = timer.endTime - timer.startTime;
            timer.active = false;

            // Record timing measurement
            this.recordMeasurement({
                name: `${timer.operation}_duration`,
                type: MetricType.Timing,
                value: timer.duration,
                unit: 'ms',
                component: timer.component,
                operation: timer.operation,
                tags: timer.tags,
            });

            this._timers.delete(timerId);
            this._log('debug', `Stopped timer for ${timer.component}.${timer.operation}`, {
                timerId,
                duration: timer.duration,
            });

            return timer.duration;
        }

        timeFunction<T>(
            fn: () => T,
            operation: string,
            component = 'unknown',
            tags: Record<string, string> = {}
        ): T {
            const timerId = this.startTimer(operation, component, tags);
            try {
                const result = fn();
                this.stopTimer(timerId);
                return result;
            } catch (error) {
                this.stopTimer(timerId);
                this.recordMeasurement({
                    name: `${operation}_error`,
                    type: MetricType.Counter,
                    value: 1,
                    unit: 'count',
                    component,
                    operation,
                    tags: { ...tags, error: error.constructor.name },
                });
                throw error;
            }
        }

        async timeAsync<T>(
            fn: () => Promise<T>,
            operation: string,
            component = 'unknown',
            tags: Record<string, string> = {}
        ): Promise<T> {
            const timerId = this.startTimer(operation, component, tags);
            try {
                const result = await fn();
                this.stopTimer(timerId);
                return result;
            } catch (error) {
                this.stopTimer(timerId);
                this.recordMeasurement({
                    name: `${operation}_error`,
                    type: MetricType.Counter,
                    value: 1,
                    unit: 'count',
                    component,
                    operation,
                    tags: { ...tags, error: error.constructor.name },
                });
                throw error;
            }
        }

        // Public API - Measurements
        recordMeasurement(measurement: Omit<PerformanceMeasurement, 'id' | 'timestamp'>): void {
            if (!this._shouldSample()) {
                return;
            }

            const fullMeasurement: PerformanceMeasurement = {
                id: `measurement_${this._nextMeasurementId++}_${Date.now()}`,
                timestamp: Date.now(),
                ...measurement,
            };

            // Store measurement
            const key = `${fullMeasurement.component}:${fullMeasurement.operation}:${fullMeasurement.name}`;
            if (!this._measurements.has(key)) {
                this._measurements.set(key, []);
            }
            this._measurements.get(key)!.push(fullMeasurement);

            // Check thresholds
            this._checkThresholds(fullMeasurement);

            // Update statistics
            this._updateStatistics(key);

            this.emit('measurement-recorded', fullMeasurement);
            this._log('debug', `Recorded ${fullMeasurement.type} measurement`, fullMeasurement);
        }

        recordCounter(
            name: string,
            value = 1,
            component = 'unknown',
            operation = 'counter',
            tags: Record<string, string> = {}
        ): void {
            this.recordMeasurement({
                name,
                type: MetricType.Counter,
                value,
                unit: 'count',
                component,
                operation,
                tags,
            });
        }

        recordGauge(
            name: string,
            value: number,
            unit: string,
            component = 'unknown',
            operation = 'gauge',
            tags: Record<string, string> = {}
        ): void {
            this.recordMeasurement({
                name,
                type: MetricType.Gauge,
                value,
                unit,
                component,
                operation,
                tags,
            });
        }

        // Threshold management
        addThreshold(threshold: PerformanceThreshold): void {
            const key = this._getThresholdKey(threshold);
            this._thresholds.set(key, threshold);
            this._log('info', `Added performance threshold for ${threshold.metric}`, threshold);
        }

        removeThreshold(metric: string, component?: string, operation?: string): boolean {
            const key = this._getThresholdKey({
                metric,
                component,
                operation,
            } as PerformanceThreshold);
            const removed = this._thresholds.delete(key);
            if (removed) {
                this._log('info', `Removed performance threshold for ${metric}`);
            }
            return removed;
        }

        getThresholds(): PerformanceThreshold[] {
            return Array.from(this._thresholds.values());
        }

        // Resource monitoring
        getCurrentResourceUsage(): ResourceUsage | null {
            if (!this._config.enableResourceMonitoring) {
                return null;
            }

            try {
                return {
                    timestamp: Date.now(),
                    memory: this._getMemoryUsage(),
                    cpu: this._getCpuUsage(),
                    io: this._getIoUsage(),
                };
            } catch (error) {
                this._log('error', 'Failed to get resource usage:', error);
                return null;
            }
        }

        getResourceHistory(timeRange?: { start: number; end: number }): ResourceUsage[] {
            if (timeRange) {
                return this._resourceHistory.filter(
                    r => r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
                );
            }
            return [...this._resourceHistory];
        }

        // Statistics and reporting
        getStatistics(
            component?: string,
            operation?: string,
            timeRange?: { start: number; end: number }
        ): PerformanceStatistics[] {
            const stats: PerformanceStatistics[] = [];

            for (const [key, measurements] of this._measurements.entries()) {
                const [comp, op] = key.split(':');

                if (component && comp !== component) {
                    continue;
                }
                if (operation && op !== operation) {
                    continue;
                }

                let filteredMeasurements = measurements;
                if (timeRange) {
                    filteredMeasurements = measurements.filter(
                        m => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
                    );
                }

                if (filteredMeasurements.length === 0) {
                    continue;
                }

                const values = filteredMeasurements.map(m => m.value).sort((a, b) => a - b);
                const statistics = this._calculateStatistics(values, comp, op, timeRange);
                stats.push(statistics);
            }

            return stats;
        }

        generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
            const defaultTimeRange = {
                start: Date.now() - this._config.retentionPeriod,
                end: Date.now(),
            };
            const range = timeRange || defaultTimeRange;

            const statistics = this.getStatistics(undefined, undefined, range);
            const alerts = this._alerts.filter(
                a => a.timestamp >= range.start && a.timestamp <= range.end
            );

            // Calculate slowest operations
            const slowestOperations = statistics
                .map(s => ({
                    component: s.component,
                    operation: s.operation || 'unknown',
                    avgDuration: s.measurement.mean,
                }))
                .sort((a, b) => b.avgDuration - a.avgDuration)
                .slice(0, 10);

            // Get resource utilization
            const resourceData = this.getResourceHistory(range);
            const avgCpu =
                resourceData.length > 0
                    ? resourceData.reduce((sum, r) => sum + r.cpu.percentage, 0) /
                      resourceData.length
                    : 0;
            const avgMemory =
                resourceData.length > 0
                    ? resourceData.reduce((sum, r) => sum + r.memory.percentage, 0) /
                      resourceData.length
                    : 0;

            const report: PerformanceReport = {
                timeRange: range,
                summary: {
                    totalMeasurements: statistics.reduce((sum, s) => sum + s.measurement.count, 0),
                    componentsAnalyzed: new Set(statistics.map(s => s.component)).size,
                    alertsGenerated: alerts.length,
                    averageResponseTime:
                        statistics.length > 0
                            ? statistics.reduce((sum, s) => sum + s.measurement.mean, 0) /
                              statistics.length
                            : 0,
                    slowestOperations,
                    resourceUtilization: { cpu: avgCpu, memory: avgMemory },
                },
                recommendations: this._generateRecommendations(statistics, resourceData),
                statistics,
                alerts,
            };

            this.emit('report-generated', report);
            this._log('info', 'Performance report generated', {
                timeRange: range,
                totalMeasurements: report.summary.totalMeasurements,
                alertsGenerated: report.summary.alertsGenerated,
            });

            return report;
        }

        // Cleanup and maintenance
        cleanup(): void {
            const now = Date.now();
            const cutoffTime = now - this._config.retentionPeriod;

            // Clean measurements
            for (const [key, measurements] of this._measurements.entries()) {
                const filteredMeasurements = measurements.filter(m => m.timestamp > cutoffTime);
                if (filteredMeasurements.length === 0) {
                    this._measurements.delete(key);
                } else {
                    this._measurements.set(key, filteredMeasurements);
                }
            }

            // Clean resource history
            this._resourceHistory = this._resourceHistory.filter(r => r.timestamp > cutoffTime);

            // Clean old alerts
            this._alerts = this._alerts.filter(a => a.timestamp > cutoffTime);

            // Clean stale timers
            for (const [timerId, timer] of this._timers.entries()) {
                if (timer.startTime < cutoffTime) {
                    this._timers.delete(timerId);
                }
            }

            this._log('debug', 'Performance monitor cleanup completed');
        }

        // Configuration
        updateConfig(config: Partial<MonitorConfig>): void {
            this._config = { ...this._config, ...config };

            // Update thresholds if provided
            if (config.thresholds) {
                this._thresholds.clear();
                for (const threshold of config.thresholds) {
                    this.addThreshold(threshold);
                }
            }

            this._log('info', 'Performance monitor configuration updated', config);
        }

        setLogger(logger: any): void {
            this._logger = logger;
        }

        // Lifecycle
        destroy(): void {
            if (this._destroyed) {
                return;
            }

            this._log('info', 'Destroying PerformanceMonitor...');

            // Stop timers
            if (this._reportTimeoutId) {
                GLib.source_remove(this._reportTimeoutId);
            }
            if (this._resourceMonitorTimeoutId) {
                GLib.source_remove(this._resourceMonitorTimeoutId);
            }

            // Generate final report
            if (this._measurements.size > 0) {
                const finalReport = this.generateReport();
                this._log('info', 'Final performance report generated', finalReport.summary);
            }

            // Clear data
            this._measurements.clear();
            this._timers.clear();
            this._thresholds.clear();
            this._alerts = [];
            this._resourceHistory = [];
            this._statistics.clear();

            this._destroyed = true;
            this._log('info', 'PerformanceMonitor destroyed');
        }

        // Private methods
        private _initialize(): void {
            // Load default thresholds
            for (const threshold of this._config.thresholds) {
                this.addThreshold(threshold);
            }

            // Start periodic reporting
            if (this._config.reportInterval > 0) {
                this._reportTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    this._config.reportInterval,
                    () => {
                        this.generateReport();
                        this.cleanup();
                        return GLib.SOURCE_CONTINUE;
                    }
                );
            }

            // Start resource monitoring
            if (this._config.enableResourceMonitoring) {
                this._resourceMonitorTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    10000,
                    () => {
                        const usage = this.getCurrentResourceUsage();
                        if (usage) {
                            this._resourceHistory.push(usage);
                            this.emit('resource-usage-updated', usage);
                        }
                        return GLib.SOURCE_CONTINUE;
                    }
                );
            }

            this._log('info', 'PerformanceMonitor initialized', this._config);
        }

        private _shouldSample(): boolean {
            return Math.random() <= this._config.sampleRate;
        }

        private _getHighResolutionTime(): number {
            // Use GLib.get_monotonic_time for microsecond precision
            return GLib.get_monotonic_time() / 1000; // Convert to milliseconds
        }

        private _checkThresholds(measurement: PerformanceMeasurement): void {
            if (!this._config.enableAlerts) {
                return;
            }

            for (const threshold of this._thresholds.values()) {
                if (!threshold.enabled) {
                    continue;
                }
                if (threshold.metric !== measurement.name) {
                    continue;
                }
                if (threshold.component && threshold.component !== measurement.component) {
                    continue;
                }
                if (threshold.operation && threshold.operation !== measurement.operation) {
                    continue;
                }

                let level: 'warning' | 'critical' | null = null;
                if (measurement.value >= threshold.critical) {
                    level = 'critical';
                } else if (measurement.value >= threshold.warning) {
                    level = 'warning';
                }

                if (level) {
                    const alert: PerformanceAlert = {
                        id: `alert_${this._nextAlertId++}_${Date.now()}`,
                        level,
                        metric: measurement.name,
                        threshold,
                        measurement,
                        timestamp: Date.now(),
                        acknowledged: false,
                    };

                    this._alerts.push(alert);
                    this.emit('threshold-exceeded', alert, level);
                    this._log('warn', `Performance threshold exceeded: ${level}`, alert);
                }
            }
        }

        private _updateStatistics(key: string): void {
            const measurements = this._measurements.get(key);
            if (!measurements || measurements.length === 0) {
                return;
            }

            const [component, operation] = key.split(':');
            const values = measurements.map(m => m.value);
            const statistics = this._calculateStatistics(values, component, operation);
            this._statistics.set(key, statistics);
        }

        private _calculateStatistics(
            values: number[],
            component: string,
            operation?: string,
            timeRange?: { start: number; end: number }
        ): PerformanceStatistics {
            if (values.length === 0) {
                throw new Error('Cannot calculate statistics for empty values array');
            }

            const sorted = [...values].sort((a, b) => a - b);
            const sum = values.reduce((a, b) => a + b, 0);
            const mean = sum / values.length;
            const variance =
                values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;

            return {
                component,
                operation,
                measurement: {
                    count: values.length,
                    min: sorted[0],
                    max: sorted[sorted.length - 1],
                    mean,
                    median: this._getPercentile(sorted, 50),
                    p95: this._getPercentile(sorted, 95),
                    p99: this._getPercentile(sorted, 99),
                    stddev: Math.sqrt(variance),
                },
                timeRange: timeRange || {
                    start: Date.now() - this._config.retentionPeriod,
                    end: Date.now(),
                },
            };
        }

        private _getPercentile(sortedValues: number[], percentile: number): number {
            if (sortedValues.length === 0) {
                return 0;
            }
            const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
            return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
        }

        private _getThresholdKey(threshold: Partial<PerformanceThreshold>): string {
            return `${threshold.metric}:${threshold.component || '*'}:${threshold.operation || '*'}`;
        }

        private _getMemoryUsage(): ResourceUsage['memory'] {
            // Placeholder - GNOME Shell doesn't provide direct memory access
            return {
                used: 0,
                available: 0,
                percentage: 0,
            };
        }

        private _getCpuUsage(): ResourceUsage['cpu'] {
            // Placeholder - GNOME Shell doesn't provide direct CPU monitoring
            return {
                percentage: 0,
                loadAverage: [0, 0, 0],
            };
        }

        private _getIoUsage(): ResourceUsage['io'] {
            // Placeholder - GNOME Shell doesn't provide direct I/O monitoring
            return {
                reads: 0,
                writes: 0,
                bytesRead: 0,
                bytesWritten: 0,
            };
        }

        private _generateRecommendations(
            statistics: PerformanceStatistics[],
            resourceData: ResourceUsage[]
        ): string[] {
            if (!this._config.enableRecommendations) {
                return [];
            }

            const recommendations: string[] = [];

            // Analyze slow operations
            const slowOperations = statistics
                .filter(s => s.measurement.mean > 1000) // > 1 second
                .sort((a, b) => b.measurement.mean - a.measurement.mean);

            if (slowOperations.length > 0) {
                recommendations.push(
                    `Consider optimizing slow operations: ${slowOperations
                        .slice(0, 3)
                        .map(
                            s =>
                                `${s.component}.${s.operation} (${s.measurement.mean.toFixed(2)}ms avg)`
                        )
                        .join(', ')}`
                );
            }

            // Analyze high variability
            const highVariabilityOps = statistics
                .filter(s => s.measurement.stddev > s.measurement.mean * 0.5)
                .sort(
                    (a, b) =>
                        b.measurement.stddev / b.measurement.mean -
                        a.measurement.stddev / a.measurement.mean
                );

            if (highVariabilityOps.length > 0) {
                recommendations.push(
                    `High performance variability detected in: ${highVariabilityOps
                        .slice(0, 3)
                        .map(s => `${s.component}.${s.operation}`)
                        .join(', ')}. Consider adding caching or optimization.`
                );
            }

            // Analyze resource usage
            if (resourceData.length > 0) {
                const avgMemoryUsage =
                    resourceData.reduce((sum, r) => sum + r.memory.percentage, 0) /
                    resourceData.length;
                const avgCpuUsage =
                    resourceData.reduce((sum, r) => sum + r.cpu.percentage, 0) /
                    resourceData.length;

                if (avgMemoryUsage > 80) {
                    recommendations.push(
                        'High memory usage detected. Consider implementing resource pooling or cleanup.'
                    );
                }

                if (avgCpuUsage > 70) {
                    recommendations.push(
                        'High CPU usage detected. Consider optimizing computationally intensive operations.'
                    );
                }
            }

            return recommendations;
        }

        private _log(level: string, message: string, data?: any): void {
            if (this._logger) {
                this._logger.log(level, `[PerformanceMonitor] ${message}`, data);
            } else {
                const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
                console[method](`[PerformanceMonitor] ${message}`, data || '');
            }
        }
    }
);
// eslint-disable-next-line no-redeclare
export type PerformanceMonitor = InstanceType<typeof PerformanceMonitor>;
