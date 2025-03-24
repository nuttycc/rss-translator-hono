import { FeedService } from './processor';
import { Cache } from '../util/cache';
import { createLogger } from '../util/logger';

const logger = createLogger('MultiFeedService');

export interface FeedConfig {
  name: string;
  url: string;
}

export interface FeedsConfig {
  feeds: FeedConfig[];
}

export class MultiFeedService {
  private cache: Cache;
  private feedServices: Map<string, FeedService>;
  private configKey: string;
  private readonly cacheTtl: number = 7200; 
  private readonly staleTtl: number = 60;
  private assets: any; // Cloudflare Workers assets binding
  private requestUrl: string;
  private provider: string;
  private model: string;
  private apiKey: string;

  constructor(cache: Cache, assets: any, requestUrl: string, provider?: string, model?: string, apiKey?: string) {
    this.cache = cache;
    this.feedServices = new Map();
    this.configKey = 'feeds:config';
    this.provider = provider || "";
    this.model = model || "";
    this.apiKey = apiKey || "";
    this.assets = assets;
    this.requestUrl = requestUrl;
    logger.debug('MultiFeedService constructed');
  }

  async initialize(): Promise<void> {
    try {
      logger.log('Initializing MultiFeedService...');
      // Load feeds configuration
      const feedsConfig = await this.loadFeedsConfig();
      
      // Initialize individual feed services
      for (const feed of feedsConfig.feeds) {
        logger.debug(`Initializing feed: |${feed.name}|`);
        const feedService = new FeedService(
          feed,
          this.cache,
          `feed:${feed.name.toLowerCase()}`,
          this.cacheTtl,
          this.staleTtl,
          this.provider,
          this.model,
          this.apiKey
        );
        
        this.feedServices.set(feed.name.toLowerCase(), feedService);
        logger.log(`Feed |${feed.name}| initialized and added to service`);
      }
      
      logger.log('MultiFeedService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MultiFeedService:', error);
      throw error;
    }
    logger.debug('☑️ All feeds initialized successfully ');
  }

  private async loadFeedsConfig(): Promise<FeedsConfig> {
    logger.debug('Loading feeds configuration...');
    const cachedConfig = await this.cache.get<FeedsConfig>(this.configKey);
    if (cachedConfig)  {
      logger.debug('🚀 Using *cached* feeds configuration', cachedConfig);
      return cachedConfig;
    }

    // If not in cache, load from assets
    logger.log('Loading feeds configuration from assets');
    const feedsResponse = await this.assets.fetch(new URL('/feeds.json', this.requestUrl).toString());
    
    logger.log(' Loading feeds configuration from assets');

    if (!feedsResponse.ok) {
      logger.error('Failed to load feeds configuration');
      throw new Error('Failed to load feeds configuration');
    }

    const feedsConfig = await feedsResponse.json() as FeedsConfig;
    
    // Cache the config with a longer TTL since it changes less frequently
    logger.log('Caching feeds configuration');
    await this.cache.put(this.configKey, feedsConfig, {
      expirationTtl: 86400, // 24 hours
    });
    logger.debug('Feeds configuration cached');

    return feedsConfig;
  }

  async getFeed(feedName: string): Promise<Response> {
    logger.log(`🔜 Getting feed: ${feedName}...`);

    const feedService = this.feedServices.get(feedName.toLowerCase());
    if (!feedService) {
      logger.warn(`Feed not found: ${feedName}`);
      throw new Error(`Feed not found: ${feedName}`);
    }

    return await feedService.getFeed();
  }

  async refreshAllFeeds(): Promise<void> {
    logger.log('Refreshing all feeds');

    try {
      const promises = Array.from(this.feedServices.values())
        .map(service => service.getFeed());
      
      await Promise.all(promises);
      logger.log('All feeds refreshed successfully');
    } catch (error: unknown) {
      logger.error('Error refreshing feeds:', error);
      throw error;
    }
  }
} 