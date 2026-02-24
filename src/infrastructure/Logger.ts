/**
 * Logger - Professional logging system with structured output and performance optimization
 * Provides consistent logging across all extension components
 */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

// Log levels in order of severity
export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
    Critical = 4,
}

// Log categories for better organization
export enum LogCategory {
    System = 'system',
    Component = 'component',
    Signal = 'signal',
    Resource = 'resource',
    Performance = 'performance',
    User = 'user',
    External = 'external',
}

// Structured log entry
export interface LogEntry {
    id: string;
    timestamp: number;
    level: LogLevel;
    category: LogCategory;
    component: string;
    message: string;
    data?: Record<string, any>;
    stackTrace?: string;
    performance?: {
        duration?: number;
        memory?: number;
        cpu?: number;
    };
}

// Logger configuration
export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableFile?: boolean;
    enableStructured?: boolean;
    maxEntries?: number;
    flushInterval?: number;
    includeMeta?: boolean;
    includeStackTrace?: boolean;
    formatTimestamp?: boolean;
    colorOutput?: boolean;
    bufferSize?: number;
}

// Log buffer for batching
interface LogBuffer {
    entries: LogEntry[];
    size: number;
    lastFlush: number;
}

// Component-specific logger
export interface ComponentLogger {
    debug(message: string, data?: any): void;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, data?: any, error?: Error): void;
    critical(message: string, data?: any, error?: Error): void;
    performance(operation: string, duration: number, data?: any): void;
    withContext(context: Record<string, any>): ComponentLogger;
}

// Log statistics
export interface LogStatistics {
    totalEntries: number;
    entriesByLevel: Map<LogLevel, number>;
    entriesByCategory: Map<LogCategory, number>;
    entriesByComponent: Map<string, number>;
    averageEntriesPerSecond: number;
    bufferUtilization: number;
    lastFlushTime: number;
}

// ANSI color codes for console output
const Colors = {
    Reset: '\x1b[0m',
    Red: '\x1b[31m',
    Yellow: '\x1b[33m',
    Blue: '\x1b[34m',
    Cyan: '\x1b[36m',
    Green: '\x1b[32m',
    Gray: '\x1b[90m',
    Bright: '\x1b[1m',
};

export class Logger extends GObject.Object {
    static [GObject.signals] = {
        'entry-logged': {
            param_types: [GObject.TYPE_VARIANT], // LogEntry
        },
        'buffer-flushed': {
            param_types: [GObject.TYPE_INT], // entry count
        },
        'error-logged': {
            param_types: [GObject.TYPE_VARIANT], // LogEntry with error
        },
        'statistics-updated': {
            param_types: [GObject.TYPE_VARIANT], // LogStatistics
        },
    };

    private _config: Required<LoggerConfig>;
    private _buffer: LogBuffer;
    private _statistics: LogStatistics;
    private _componentContexts: Map<string, Record<string, any>> = new Map();
    private _flushTimeoutId: number | null = null;
    private _nextEntryId: number = 1;
    private _startTime: number = Date.now();
    private _fileStream: Gio.FileOutputStream | null = null;
    private _destroyed: boolean = false;

    constructor(config: Partial<LoggerConfig> = {}) {
        super();

        this._config = {
            level: LogLevel.Info,
            enableConsole: true,
            enableFile: false,
            enableStructured: true,
            maxEntries: 10000,
            flushInterval: 5000,
            includeMeta: true,
            includeStackTrace: false,
            formatTimestamp: true,
            colorOutput: true,
            bufferSize: 100,
            ...config,
        };

        this._buffer = {
            entries: [],
            size: 0,
            lastFlush: Date.now(),
        };

        this._statistics = {
            totalEntries: 0,
            entriesByLevel: new Map(),
            entriesByCategory: new Map(),
            entriesByComponent: new Map(),
            averageEntriesPerSecond: 0,
            bufferUtilization: 0,
            lastFlushTime: 0,
        };

        this._initialize();
    }

    // Public API
    log(
        level: LogLevel,
        message: string,
        data?: any,
        category: LogCategory = LogCategory.System,
        component: string = 'unknown'
    ): void {
        if (this._destroyed || level < this._config.level) {
            return;
        }

        const entry = this._createLogEntry(level, message, data, category, component);
        this._addToBuffer(entry);

        // Immediate console output for critical errors
        if (level >= LogLevel.Error || !this._config.enableStructured) {
            this._outputToConsole(entry);
        }
    }

    debug(message: string, data?: any, component: string = 'system'): void {
        this.log(LogLevel.Debug, message, data, LogCategory.System, component);
    }

    info(message: string, data?: any, component: string = 'system'): void {
        this.log(LogLevel.Info, message, data, LogCategory.System, component);
    }

    warn(message: string, data?: any, component: string = 'system'): void {
        this.log(LogLevel.Warn, message, data, LogCategory.System, component);
    }

    error(message: string, data?: any, error?: Error, component: string = 'system'): void {
        const entryData = { ...data };
        if (error) {
            entryData.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        this.log(LogLevel.Error, message, entryData, LogCategory.System, component);
    }

    critical(message: string, data?: any, error?: Error, component: string = 'system'): void {
        const entryData = { ...data };
        if (error) {
            entryData.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        this.log(LogLevel.Critical, message, entryData, LogCategory.System, component);
    }

    performance(
        operation: string,
        duration: number,
        data?: any,
        component: string = 'system'
    ): void {
        const perfData = {
            ...data,
            operation,
            duration,
            memory: this._getMemoryUsage(),
        };

        this.log(
            LogLevel.Info,
            `Performance: ${operation} completed in ${duration}ms`,
            perfData,
            LogCategory.Performance,
            component
        );
    }

    // Component-specific logger factory
    createComponentLogger(
        componentName: string,
        category: LogCategory = LogCategory.Component,
        context: Record<string, any> = {}
    ): ComponentLogger {
        // Store component context
        this._componentContexts.set(componentName, context);

        return {
            debug: (message: string, data?: any) => {
                this.log(
                    LogLevel.Debug,
                    message,
                    this._mergeWithContext(componentName, data),
                    category,
                    componentName
                );
            },
            info: (message: string, data?: any) => {
                this.log(
                    LogLevel.Info,
                    message,
                    this._mergeWithContext(componentName, data),
                    category,
                    componentName
                );
            },
            warn: (message: string, data?: any) => {
                this.log(
                    LogLevel.Warn,
                    message,
                    this._mergeWithContext(componentName, data),
                    category,
                    componentName
                );
            },
            error: (message: string, data?: any, error?: Error) => {
                const errorData = this._mergeWithContext(componentName, data);
                if (error) {
                    errorData.error = {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                    };
                }
                this.log(LogLevel.Error, message, errorData, category, componentName);
            },
            critical: (message: string, data?: any, error?: Error) => {
                const errorData = this._mergeWithContext(componentName, data);
                if (error) {
                    errorData.error = {
                        name: error.name,
                        message: error.message,
                        stack: error.stack,
                    };
                }
                this.log(LogLevel.Critical, message, errorData, category, componentName);
            },
            performance: (operation: string, duration: number, data?: any) => {
                this.performance(
                    operation,
                    duration,
                    this._mergeWithContext(componentName, data),
                    componentName
                );
            },
            withContext: (additionalContext: Record<string, any>) => {
                const mergedContext = { ...context, ...additionalContext };
                return this.createComponentLogger(componentName, category, mergedContext);
            },
        };
    }

    // Timing utilities
    startTimer(label: string): () => void {
        const startTime = Date.now();
        return () => {
            const duration = Date.now() - startTime;
            this.performance(label, duration);
        };
    }

    async timeAsync<T>(
        label: string,
        operation: () => Promise<T>,
        component: string = 'system'
    ): Promise<T> {
        const startTime = Date.now();
        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            this.performance(label, duration, { success: true }, component);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.performance(label, duration, { success: false, error: error.message }, component);
            throw error;
        }
    }

    // Configuration
    setLevel(level: LogLevel): void {
        this._config.level = level;
        this.info('Log level changed', { newLevel: LogLevel[level] });
    }

    enableFileLogging(filename?: string): void {
        try {
            const logFile = filename || `grayscale-extension-${Date.now()}.log`;
            const file = Gio.File.new_for_path(GLib.build_filenamev([GLib.get_tmp_dir(), logFile]));
            this._fileStream = file.create(Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            this._config.enableFile = true;
            this.info('File logging enabled', { logFile: file.get_path() });
        } catch (error) {
            this.error('Failed to enable file logging', { filename }, error);
        }
    }

    disableFileLogging(): void {
        if (this._fileStream) {
            this._fileStream.close(null);
            this._fileStream = null;
        }
        this._config.enableFile = false;
        this.info('File logging disabled');
    }

    // Buffer management
    flush(): void {
        if (this._buffer.entries.length === 0) {
            return;
        }

        const entries = [...this._buffer.entries];
        this._buffer.entries = [];
        this._buffer.size = 0;
        this._buffer.lastFlush = Date.now();

        // Output to console if structured logging is enabled
        if (this._config.enableStructured) {
            for (const entry of entries) {
                this._outputToConsole(entry);
            }
        }

        // Output to file if enabled
        if (this._config.enableFile && this._fileStream) {
            this._outputToFile(entries);
        }

        this._updateStatistics();
        this.emit('buffer-flushed', entries.length);
    }

    // Inspection
    getStatistics(): LogStatistics {
        this._statistics.bufferUtilization = (this._buffer.size / this._config.bufferSize) * 100;
        return { ...this._statistics };
    }

    getRecentEntries(count: number = 50, level?: LogLevel): LogEntry[] {
        const allEntries = [...this._buffer.entries];

        if (level !== undefined) {
            return allEntries.filter(e => e.level >= level).slice(-count);
        }

        return allEntries.slice(-count);
    }

    searchLogs(
        query: string,
        options: {
            component?: string;
            category?: LogCategory;
            level?: LogLevel;
            timeRange?: { start: number; end: number };
        } = {}
    ): LogEntry[] {
        return this._buffer.entries.filter(entry => {
            // Text search
            const matchesQuery =
                !query ||
                entry.message.toLowerCase().includes(query.toLowerCase()) ||
                JSON.stringify(entry.data || {})
                    .toLowerCase()
                    .includes(query.toLowerCase());

            // Component filter
            const matchesComponent = !options.component || entry.component === options.component;

            // Category filter
            const matchesCategory = !options.category || entry.category === options.category;

            // Level filter
            const matchesLevel = options.level === undefined || entry.level >= options.level;

            // Time range filter
            const matchesTimeRange =
                !options.timeRange ||
                (entry.timestamp >= options.timeRange.start &&
                    entry.timestamp <= options.timeRange.end);

            return (
                matchesQuery &&
                matchesComponent &&
                matchesCategory &&
                matchesLevel &&
                matchesTimeRange
            );
        });
    }

    // Lifecycle
    destroy(): void {
        if (this._destroyed) {
            return;
        }

        // Flush remaining entries
        this.flush();

        // Clean up file stream
        if (this._fileStream) {
            this._fileStream.close(null);
            this._fileStream = null;
        }

        // Clear timeout
        if (this._flushTimeoutId) {
            GLib.source_remove(this._flushTimeoutId);
            this._flushTimeoutId = null;
        }

        // Clear data
        this._buffer.entries = [];
        this._componentContexts.clear();

        this._destroyed = true;
        console.log('[Logger] Logger destroyed');
    }

    // Private methods
    private _initialize(): void {
        // Start flush timer
        this._startFlushTimer();

        this.info('Logger initialized', {
            config: this._config,
            pid: GLib.getenv('PID') || 'unknown',
        });
    }

    private _createLogEntry(
        level: LogLevel,
        message: string,
        data: any,
        category: LogCategory,
        component: string
    ): LogEntry {
        const entry: LogEntry = {
            id: `log_${this._nextEntryId++}_${Date.now()}`,
            timestamp: Date.now(),
            level,
            category,
            component,
            message,
            data: data ? this._sanitizeData(data) : undefined,
        };

        // Add stack trace for errors if enabled
        if (this._config.includeStackTrace && level >= LogLevel.Error) {
            entry.stackTrace = new Error().stack;
        }

        // Add performance metrics if enabled
        if (this._config.includeMeta) {
            entry.performance = {
                memory: this._getMemoryUsage(),
            };
        }

        return entry;
    }

    private _addToBuffer(entry: LogEntry): void {
        this._buffer.entries.push(entry);
        this._buffer.size++;

        // Trim buffer if exceeded max entries
        if (this._buffer.entries.length > this._config.maxEntries) {
            this._buffer.entries.shift();
            this._buffer.size--;
        }

        // Force flush if buffer is full
        if (this._buffer.size >= this._config.bufferSize) {
            this.flush();
        }

        this.emit('entry-logged', entry);

        if (entry.level >= LogLevel.Error) {
            this.emit('error-logged', entry);
        }
    }

    private _outputToConsole(entry: LogEntry): void {
        if (!this._config.enableConsole) {
            return;
        }

        const formattedMessage = this._formatConsoleMessage(entry);
        const outputMethod = this._getConsoleMethod(entry.level);
        outputMethod(formattedMessage);
    }

    private _outputToFile(entries: LogEntry[]): void {
        if (!this._fileStream) {
            return;
        }

        try {
            const jsonLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';

            const bytes = new TextEncoder().encode(jsonLines);
            this._fileStream.write(bytes, null);
            this._fileStream.flush(null);
        } catch (error) {
            console.error('[Logger] Failed to write to file:', error);
        }
    }

    private _formatConsoleMessage(entry: LogEntry): string {
        const levelName = LogLevel[entry.level].toUpperCase();
        const timestamp = this._config.formatTimestamp
            ? new Date(entry.timestamp).toISOString()
            : entry.timestamp.toString();

        let message = `[${timestamp}] [${levelName}] [${entry.component}] ${entry.message}`;

        // Add data if present
        if (entry.data) {
            message += ` ${JSON.stringify(entry.data)}`;
        }

        // Add color if enabled
        if (this._config.colorOutput) {
            const color = this._getLevelColor(entry.level);
            message = `${color}${message}${Colors.Reset}`;
        }

        return message;
    }

    private _getLevelColor(level: LogLevel): string {
        switch (level) {
            case LogLevel.Debug:
                return Colors.Gray;
            case LogLevel.Info:
                return Colors.Cyan;
            case LogLevel.Warn:
                return Colors.Yellow;
            case LogLevel.Error:
                return Colors.Red;
            case LogLevel.Critical:
                return `${Colors.Bright}${Colors.Red}`;
            default:
                return Colors.Reset;
        }
    }

    private _getConsoleMethod(level: LogLevel): (...args: any[]) => void {
        switch (level) {
            case LogLevel.Debug:
                return console.debug.bind(console);
            case LogLevel.Info:
                return console.info.bind(console);
            case LogLevel.Warn:
                return console.warn.bind(console);
            case LogLevel.Error:
                return console.error.bind(console);
            case LogLevel.Critical:
                return console.error.bind(console);
            default:
                return console.log.bind(console);
        }
    }

    private _startFlushTimer(): void {
        if (this._config.flushInterval > 0) {
            this._flushTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this._config.flushInterval,
                () => {
                    this.flush();
                    return GLib.SOURCE_CONTINUE;
                }
            );
        }
    }

    private _mergeWithContext(componentName: string, data?: any): any {
        const context = this._componentContexts.get(componentName) || {};
        return { ...context, ...data };
    }

    private _sanitizeData(data: any): any {
        // Remove circular references and limit depth
        try {
            return JSON.parse(JSON.stringify(data, null, 0));
        } catch {
            return '[Unsanitizable data]';
        }
    }

    private _getMemoryUsage(): number {
        // GNOME Shell doesn't provide direct memory access
        // This is a placeholder that could be enhanced with system monitoring
        return 0;
    }

    private _updateStatistics(): void {
        const now = Date.now();
        const elapsed = (now - this._startTime) / 1000;

        this._statistics.averageEntriesPerSecond = this._statistics.totalEntries / elapsed;
        this._statistics.lastFlushTime = now;

        this.emit('statistics-updated', this._statistics);
    }
}

// Global logger instance
let globalLogger: Logger | null = null;

export function createLogger(config?: Partial<LoggerConfig>): Logger {
    if (globalLogger) {
        globalLogger.destroy();
    }
    globalLogger = new Logger(config);
    return globalLogger;
}

export function getLogger(): Logger {
    if (!globalLogger) {
        globalLogger = new Logger();
    }
    return globalLogger;
}
