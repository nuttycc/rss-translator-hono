const APP_NAME = 'rss-translator-hono'

// Create a type-safe logger factory
type Logger = {
    log: (...args: unknown[]) => void
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
}

// Create a logger instance with namespace
export function createLogger(namespace: string): Logger {
    return {
        log: (...args) => console.log(`[${namespace}][LOG]`, ...args),
        info: (...args) => console.info(`[${namespace}][INFO]`, ...args),
        warn: (...args) => console.warn(`[${namespace}][WARN] 🟡`, ...args),
        error: (...args) => console.error(`[${namespace}][ERROR] 🔴`, ...args),
        debug: (...args) => console.debug(`[${namespace}][DEBUG]`, ...args),
    }
}

// Default logger instance
export const logger = createLogger(APP_NAME)




