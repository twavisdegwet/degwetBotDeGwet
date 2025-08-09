import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../utils/logger';
import { env } from '../../config/env';

export interface NZBHydraSearchResult {
  title: string;
  size: number;
  indexer: string;
  guid: string;
  category: string;
  details: string;
  downloadType: string;
}

export class NZBHydraClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.NZBHYDRA_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }

  async searchMovies(query: string, year?: number, quality?: string): Promise<NZBHydraSearchResult[]> {
    try {
      const params = new URLSearchParams({
        category: 'Movies',
        mode: 'movie',
        query: `${query} ${year || ''} ${quality || ''}`.trim(),
        limit: '50'
      });

      const response = await this.client.get(`/api?${params}`);
      
      return response.data.results
        .filter((result: any) => result.category === 'Movies')
        .map((result: any) => ({
          title: result.name,
          size: result.size,
          indexer: result.indexer,
          guid: result.guid,
          category: result.category,
          details: result.details,
          downloadType: result.downloadType
        }));
    } catch (error) {
      Logger.error('NZBHydra search failed:', error);
      throw new Error('Failed to search NZBHydra');
    }
  }

  async getNzbUrl(guid: string): Promise<string> {
    return `${env.NZBHYDRA_URL}/getnzb/${guid}`;
  }
}
