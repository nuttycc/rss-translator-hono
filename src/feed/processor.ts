import { Cache } from '../util/cache';
import { createLogger } from '../util/logger';
import { RSSXMLString, translateFeedTitles } from '../translator';
import { fetchFeed } from '../util/feed';
import { Feed } from '../types/feed.type';

const feedServiceLogger = createLogger('FeedService');

export interface FeedProcessor {
  generateContent(): Promise<RSSXMLString>;
  translateContent?(content: RSSXMLString): Promise<RSSXMLString>;
}

export interface CacheMetadata {
  timestamp: number;
}


export class FeedService {
  private feed: Feed;
  private cache: Cache;
  private processor: FeedProcessor;
  private cacheKey: string;
  private cacheTtl: number;
  private staleTtl: number;
  private provider: string;
  private apiKey: string;

  defaultProcessor: FeedProcessor = {
    generateContent: async () => {
      return await fetchFeed(this.feed.url);
    },
    translateContent: async (content: RSSXMLString) => {
      return await translateFeedTitles(content, this.provider, this.apiKey);
    }
  }

  constructor(
    feed: Feed,
    cache: Cache,
    cacheKey: string,
    cacheTtl: number, 
    staleTtl: number,  
    provider: string,
    apiKey: string,
    processor: FeedProcessor = this.defaultProcessor,
  ) {
    this.feed = feed;
    this.cache = cache;
    this.processor = processor;
    this.cacheKey = cacheKey;
    this.cacheTtl = cacheTtl;
    this.staleTtl = staleTtl;
    this.provider = provider;
    this.apiKey = apiKey;
    feedServiceLogger.debug(`FeedService constructed with cacheKey: ${this.cacheKey}, cacheTtl: ${this.cacheTtl}, staleTtl: ${this.staleTtl}`);
  }

  /**
   * Gets the feed content from the cache, or generates and stores it if it's not cached.
   * @returns A Response object with the feed content, and Cache-Control headers that indicate
   *          when the cache is stale and should be revalidated.
   * @remarks This function uses the cache to store the generated content, and to trigger
   *          background refreshes of the cache when it's stale but not expired. The cache
   *          key is the `cacheKey` property of the FeedService instance, and the cache
   *          metadata is a JSON object with a single property called `timestamp` which
   *          is the timestamp at which the content was generated.
   */
  async getFeed(): Promise<Response> {
    feedServiceLogger.log(`🔜 Try to get feed from cache: |${this.cacheKey}|`);

    // Try to get cached response first
    const cachedResponse = await this.cache.get<string>(this.cacheKey);
    
    feedServiceLogger.debug(`Cached response: ${cachedResponse ? 'found' : 'not found'} for cacheKey: |${this.cacheKey}|`);

    if (cachedResponse) {
      // Start background revalidation if metadata exists and indicates staleness
      const metadata = await this.cache.getMetadata<CacheMetadata>(this.cacheKey);
      const timestamp = metadata?.timestamp;
      const now = Date.now();

      feedServiceLogger.debug(`Cache metadata: timestamp=${timestamp}, now=${now}, cacheTtl=${this.cacheTtl}, staleTtl=${this.staleTtl}`);

      // If the cache is stale but not expired, trigger background refresh
      if (timestamp && now - timestamp > this.cacheTtl * 1000 && now - timestamp < this.staleTtl * 1000) {
        feedServiceLogger.log(`Cache is stale, triggering background refresh for cacheKey: |${this.cacheKey}|`);
        this.refreshCache();
      }
      
      const cacheControl = `public, max-age=${this.cacheTtl}, stale-while-revalidate=${this.staleTtl - this.cacheTtl}`;
      feedServiceLogger.debug(`Returning cached response with Cache-Control: ${cacheControl}`);
      return new Response(cachedResponse, {
        headers: {
          'Content-Type': 'text/xml',
          'Cache-Control': cacheControl,
          'X-Cache': 'HIT',
        },
      });
    }
    
    // If not cached, generate fresh content
    feedServiceLogger.log(`Cache miss, generating fresh content for cacheKey: |${this.cacheKey}|`);
    const responseContent = await this.generateFreshContent();
    
    // Store in KV cache with TTL and timestamp metadata
    feedServiceLogger.log(`Storing fresh content in cache for cacheKey: |${this.cacheKey}|`);
    await this.cache.put<CacheMetadata>(this.cacheKey, responseContent, { 
      expirationTtl: this.staleTtl,
      metadata: { timestamp: Date.now() }
    });
    feedServiceLogger.debug(`Content stored in cache with expirationTtl: |${this.staleTtl}|`);
    
    const cacheControl = `public, max-age=${this.cacheTtl}, stale-while-revalidate=${this.staleTtl - this.cacheTtl}`;
    feedServiceLogger.debug(`Returning fresh response with Cache-Control: ${cacheControl}`);
    return new Response(responseContent, {
      headers: {
        'Content-Type': 'text/xml',
        'Cache-Control': cacheControl,
        'X-Cache': 'MISS',
      },
    });
  }

  /**
   * Generates fresh content for the cacheKey, optionally translating the content
   * with the processor's translateContent method.
   * @returns The generated and optionally translated content as a string.
   */
  private async generateFreshContent(): Promise<string> {
    feedServiceLogger.log(`Generating fresh content for cacheKey: |${this.cacheKey}|`);
    const content = await this.processor.generateContent();
    feedServiceLogger.debug('Content generated');
    if (this.processor.translateContent) {
      feedServiceLogger.log(`Translating content for cacheKey: |${this.cacheKey}|`);
      const translatedContent = await this.processor.translateContent(content);
      feedServiceLogger.debug('Content translated');
      return translatedContent;
    }
    return content;
  }

  private async refreshCache(): Promise<void> {
    feedServiceLogger.log(`Refreshing cache for cacheKey: ${this.cacheKey}`);
    try {
      const freshContent = await this.generateFreshContent();
      await this.cache.put<CacheMetadata>(this.cacheKey, freshContent, {
        expirationTtl: this.staleTtl,
        metadata: { timestamp: Date.now() }
      });
      feedServiceLogger.debug('Cache refreshed successfully');
    } catch (error) {
      feedServiceLogger.error('Background cache refresh failed:', error);
    }
  }
} 