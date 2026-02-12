import type { SearchParams, SearchQuery } from '@lobechat/types';
import type { Crawler, CrawlImplType, CrawlUniformResult } from '@lobechat/web-crawler';
import debug from 'debug';
import pMap from 'p-map';

import { toolsEnv } from '@/envs/tools';

import { type SearchImplType, type SearchServiceImpl } from './impls';
import { createSearchServiceImpl } from './impls';

const DEFAULT_CRAWL_CONCURRENCY = 3;
const DEFAULT_CRAWLER_RETRY = 1;
const log = debug('lobe-oom:web-browsing:search-service');

const parseImplEnv = (envString: string = '') => {
  // Handle full-width commas and extra whitespace
  const envValue = envString.replaceAll('，', ',').trim();
  return envValue.split(',').filter(Boolean);
};

const getMemorySnapshot = () => {
  if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') {
    return 'non-node';
  }

  const { heapUsed, rss } = process.memoryUsage();

  return `rss=${(rss / 1024 / 1024).toFixed(1)}MB heap=${(heapUsed / 1024 / 1024).toFixed(1)}MB`;
};

/**
 * Search service class
 * Uses Round-Robin + Fallback strategy across configured providers
 */
export class SearchService {
  private currentIndex = 0;
  private searchImplInstances: SearchServiceImpl[];

  private get crawlerImpls() {
    return parseImplEnv(toolsEnv.CRAWLER_IMPLS);
  }

  private get crawlConcurrency() {
    return toolsEnv.CRAWL_CONCURRENCY ?? DEFAULT_CRAWL_CONCURRENCY;
  }

  private get crawlerRetry() {
    return toolsEnv.CRAWLER_RETRY ?? DEFAULT_CRAWLER_RETRY;
  }

  constructor() {
    const implTypes = this.searchImplTypes;

    this.searchImplInstances =
      implTypes.length > 0
        ? implTypes.map((type) => createSearchServiceImpl(type))
        : [createSearchServiceImpl()];
  }

  async crawlPages(input: { impls?: CrawlImplType[]; urls: string[] }) {
    try {
      if (log.enabled) {
        log(
          'crawlPages:start urls=%d impls=%s mem=%s',
          input.urls.length,
          (input.impls || this.crawlerImpls).join(',') || '-',
          getMemorySnapshot(),
        );
      }
    } catch {}

    const { Crawler } = await import('@lobechat/web-crawler');
    const crawler = new Crawler({ impls: this.crawlerImpls });

    const results = await pMap(
      input.urls,
      async (url) => {
        return await this.crawlWithRetry(crawler, url, input.impls);
      },
      { concurrency: this.crawlConcurrency },
    );

    return { results };
  }

  private async crawlWithRetry(
    crawler: Crawler,
    url: string,
    impls?: CrawlImplType[],
  ): Promise<CrawlUniformResult> {
    const maxAttempts = this.crawlerRetry + 1;
    let lastResult: CrawlUniformResult | undefined;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await crawler.crawl({ impls, url });
        try {
          if (log.enabled) {
            log('crawlWithRetry:result crawler=%s mem=%s', result.crawler, getMemorySnapshot());
          }
        } catch {}
        lastResult = result;

        if (!this.isFailedCrawlResult(result)) {
          return result;
        }
      } catch (error) {
        lastError = error as Error;
      }
    }

    if (lastResult) {
      return lastResult;
    }

    return {
      crawler: 'unknown',
      data: {
        content: `Fail to crawl the page. Error type: ${lastError?.name || 'UnknownError'}, error message: ${lastError?.message}`,
        errorMessage: lastError?.message,
        errorType: lastError?.name || 'UnknownError',
      },
      originalUrl: url,
    };
  }

  /**
   * A successful crawl result always includes `contentType` (e.g. 'text', 'json')
   * in `result.data`, while a failed result contains `errorType`/`errorMessage` instead.
   */
  private isFailedCrawlResult(result: CrawlUniformResult): boolean {
    return !('contentType' in result.data);
  }

  /**
   * Get the next provider index via Round-Robin
   */
  private getNextIndex(): number {
    const index = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.searchImplInstances.length;
    return index;
  }

  private get searchImplTypes() {
    return parseImplEnv(toolsEnv.SEARCH_PROVIDERS) as SearchImplType[];
  }

  /**
   * Query with Round-Robin provider selection and Fallback on error
   */
  async query(query: string, params?: SearchParams) {
    const impls = this.searchImplInstances;
    const primaryIndex = this.getNextIndex();

    // Try the primary provider first
    try {
      return await impls[primaryIndex].query(query, params);
    } catch (primaryError) {
      // Fallback: try remaining providers in order
      for (let i = 0; i < impls.length; i++) {
        if (i === primaryIndex) continue;

        try {
          return await impls[i].query(query, params);
        } catch {
          // continue to next provider
        }
      }

      // All providers failed, throw the primary error
      throw primaryError;
    }
  }

  async webSearch({ query, searchCategories, searchEngines, searchTimeRange }: SearchQuery) {
    for (const impl of this.searchImplInstances) {
      let data = await impl.query(query, {
        searchCategories,
        searchEngines,
        searchTimeRange,
      });

      // First retry: remove search engine restrictions if no results found
      if (data.results.length === 0 && searchEngines && searchEngines?.length > 0) {
        data = await impl.query(query, {
          searchCategories,
          searchEngines: undefined,
          searchTimeRange,
        });
      }

      // Second retry: remove all restrictions if still no results found
      if (data.results.length === 0) {
        data = await impl.query(query);
      }

      // If this provider returned results, use them
      if (data.results.length > 0) {
        return data;
      }
    }

    // All providers exhausted, return empty result
    return { costTime: 0, query, resultNumbers: 0, results: [] };
  }
}

// Add a default exported instance for convenience
export const searchService = new SearchService();
