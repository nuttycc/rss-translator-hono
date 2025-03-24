import { createLogger } from './logger';

// Create a logger instance for the Cache class
const logger = createLogger('Cache');

export interface CacheOptions<T = Record<string, unknown>> {
  expirationTtl?: number; // Time to live in seconds
  metadata?: T;
}

export class Cache {
  private namespace: KVNamespace;
  private defaultTtl: number;
  private isDev: boolean;

  constructor(namespace: KVNamespace, env: { ENVIRONMENT?: string } | Record<string, unknown>, defaultTtl = 60) {
    this.namespace = namespace;
    this.defaultTtl = defaultTtl;
    this.isDev = (env as { ENVIRONMENT?: string }).ENVIRONMENT === 'dev';
  }

  async get<T>(key: string): Promise<T | null> {
    logger.debug(`Attempting to get key: |${key}|...`);

    const value = await this.namespace.get(key);
    if (!value) {
      logger.debug(`Key not found: ${key}`);
      return null;
    }
    logger.debug(`🚀 Cache hit for key: |${key}|`);

    try {
      const jsonValue = JSON.parse(value) as T;
      return jsonValue;
    } catch (_) {
      return value as unknown as T;
    }
  }

  async getMetadata<T>(key: string): Promise<T | null> {
    logger.debug(`Getting metadata for key: ${key}...`);
    
    const result = await this.namespace.getWithMetadata(key);

    logger.debug(`🚀 metadata retrieved for key: ${key}`, result.metadata);

    return result.metadata as T;
  }

  async put<T = Record<string, unknown>>(
    key: string, 
    value: unknown, 
    options?: CacheOptions<T>
  ): Promise<void> {
    if (this.isDev) {
      logger.debug(`Attempting to put value for key: ${key}`, { 
        hasValue: !!value,
        ttl: options?.expirationTtl || this.defaultTtl,
        hasMetadata: !!options?.metadata
      });
    }

    const serializedValue = typeof value === 'string' 
      ? value 
      : JSON.stringify(value);
    
    await this.namespace.put(
      key, 
      serializedValue, 
      { 
        expirationTtl: options?.expirationTtl || this.defaultTtl,
        metadata: options?.metadata as Record<string, unknown>
      }
    );

  
    logger.debug(`🚀 Successfully stored value for key: ${key}`);
    
  }

  async delete(key: string): Promise<void> {
    logger.debug(`Attempting to delete key: ${key}`);
    await this.namespace.delete(key);
    logger.debug(`🚀 Successfully deleted key: ${key}`);
  }
} 