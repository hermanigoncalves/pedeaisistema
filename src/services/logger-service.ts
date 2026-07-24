import { supabase } from '@/integrations/supabase/client';

export type LogLevel = 'error' | 'warning' | 'info' | 'success';
export type LogCategory = 'auth' | 'order' | 'payment' | 'system' | 'database' | 'product' | 'user';

export interface SystemLog {
    id: number;
    created_at: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
    details?: any;
    restaurant_id?: string;
    user_agent?: string;
    ip_address?: string;
}

class LoggerService {
    private queue: Array<Omit<SystemLog, 'id' | 'created_at'>> = [];
    private isProcessing = false;
    private maxQueueSize = 100;

    async log(
        level: LogLevel,
        category: LogCategory,
        message: string,
        details?: any,
        restaurantId?: string
    ): Promise<void> {
        const logEntry = {
            level,
            category,
            message,
            details: details ? JSON.stringify(details) : null,
            restaurant_id: restaurantId || null,
            user_agent: navigator.userAgent,
            ip_address: null, // Will be set by server if needed
        };

        // Add to queue
        this.queue.push(logEntry);

        // Limit queue size
        if (this.queue.length > this.maxQueueSize) {
            this.queue.shift();
        }

        // Process queue
        if (!this.isProcessing) {
            this.processQueue();
        }

        // Also log to console in development
        if (import.meta.env.DEV) {
            const emoji = {
                error: '🔴',
                warning: '🟡',
                info: '🔵',
                success: '🟢',
            }[level];
            console.log(`${emoji} [${category.toUpperCase()}] ${message}`, details || '');
        }
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, 10); // Process in batches of 10

            try {
                const { error } = await supabase
                    .from('system_logs' as any)
                    .insert(batch);

                if (error) {
                    console.error('Failed to insert logs:', error);
                    // Re-add failed logs to queue
                    this.queue.unshift(...batch);
                    break;
                }
            } catch (err) {
                console.error('Logger error:', err);
                break;
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.isProcessing = false;
    }

    // Convenience methods
    error(category: LogCategory, message: string, details?: any, restaurantId?: string) {
        return this.log('error', category, message, details, restaurantId);
    }

    warning(category: LogCategory, message: string, details?: any, restaurantId?: string) {
        return this.log('warning', category, message, details, restaurantId);
    }

    info(category: LogCategory, message: string, details?: any, restaurantId?: string) {
        return this.log('info', category, message, details, restaurantId);
    }

    success(category: LogCategory, message: string, details?: any, restaurantId?: string) {
        return this.log('success', category, message, details, restaurantId);
    }
}

// Singleton instance
export const logger = new LoggerService();

// Setup global error handler
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        logger.error('system', 'Uncaught error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error?.stack,
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        logger.error('system', 'Unhandled promise rejection', {
            reason: event.reason,
            promise: event.promise,
        });
    });
}
