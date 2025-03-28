import { Hono } from 'hono'
import { Cache } from './util/cache';
import { createLogger } from './util/logger';
import { logger as honoLogger } from 'hono/logger'
import { MultiFeedService } from './feed/multi-feed-service';
import * as Sentry from "@sentry/cloudflare";

interface FeedConfig {
  name: string;
  url: string;
}

interface FeedsConfig {
  feeds: FeedConfig[];
}

type Bindings = {
  ENVIRONMENT: string;
  PROVIDER: string;
  MODEL: string;
  API_KEY: string;
  RSS_CACHE: KVNamespace;
  ASSETS: {
    fetch: (path: string) => Promise<Response>;
  };
}

// const CACHE_KEY = 'hn-feed-xml';

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use(honoLogger())

const logger = createLogger('[index]')

// Initialize services
let cache: Cache;
let multiFeedService: MultiFeedService;

app.use('*', async (c, next) => {
  logger.debug('🚩 Capturing * request...', c.env);

  if (!cache) {
    cache = new Cache(c.env.RSS_CACHE, c.env);
    multiFeedService = new MultiFeedService(cache, c.env.ASSETS, c.req.url, c.env.PROVIDER, c.env.MODEL, c.env.API_KEY);
    await multiFeedService.initialize()
  } else {
    logger.debug('🚀 Cache already initialized');
  }
  await next();
});

// Routes

app.get('/feeds/:feed', async (c) => {
  logger.debug('🚩 Capturing /feeds/:feed request...');

  const feedName = c.req.param('feed')
  
  try {
    const response = await multiFeedService.getFeed(feedName);
    return response;
  } catch (error: unknown) {
    logger.error('🔴 Error processing feed:', error);
    if (error instanceof Error && error.message.includes('Feed not found')) {
      return c.json({ error: 'Feed not found' }, 404);
    }
    return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
})

// Optional: Add an endpoint to refresh all feeds
app.post('/feeds/refresh', async (c) => {
  try {
    await multiFeedService.refreshAllFeeds();
    return c.json({ message: 'All feeds refreshed successfully' });
  } catch (error) {
    logger.error('Failed to refresh feeds:', error);
    return c.json({ error: 'Failed to refresh feeds' }, 500);
  }
});

app.get('/', async (c) => {
  try {
    const feedsFile = await c.env.ASSETS.fetch(new URL('/feeds.json', c.req.url).toString());
    if (!feedsFile.ok) {
      return c.json({ error: 'Failed to load feeds configuration' }, 500);
    }
    const feedsConfig: FeedsConfig = await feedsFile.json();
    
    return c.html(
      `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>RSS Translator</title>
          <style>
            body {
              background-color: #0f172a;
              color: #e2e8f0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 2rem;
              min-height: 100vh;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              color: #60a5fa;
              margin-bottom: 2rem;
              text-align: center;
            }
            .feeds-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
              gap: 1rem;
              padding: 1rem;
            }
            .feed-link {
              background-color: #1e293b;
              border-radius: 8px;
              padding: 1rem;
              text-decoration: none;
              color: #e2e8f0;
              transition: all 0.3s ease;
              text-align: center;
              border: 1px solid #334155;
            }
            .feed-link:hover {
              background-color: #334155;
              transform: translateY(-2px);
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>RSS Translator</h1>
            <div class="feeds-grid">
              ${feedsConfig.feeds.map(feed => 
                `<a href="/feeds/${feed.name}" class="feed-link">${feed.name}</a>`
              ).join('')}
            </div>
          </div>
        </body>
      </html>
      `
    );
  } catch (error) {
    console.error('Error loading feeds:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
})

// Cache clear endpoint
app.delete('/api/clearcache', async (c) => {
  try {
    if (!cache) {
      cache = new Cache(c.env.RSS_CACHE, c.env);
    }
    
    // Delete the feeds config from cache
    await cache.delete('feeds:config');
    
    return c.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return c.json({ error: 'Failed to clear cache' }, 500);
  }
});

export default Sentry.withSentry(
  (env) => ({
    dsn: "https://7fabbec3bf25287945779a6b233fd914@o4509054520852480.ingest.us.sentry.io/4509054555979776",
  }),
  app
);