import axios, { AxiosInstance } from 'axios';
import { parseString } from 'xml2js';
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
      params: {
        apikey: env.NZBHYDRA_API_KEY
      }
    });
  }

  async searchMovies(query: string, year?: number, quality?: string): Promise<NZBHydraSearchResult[]> {
    try {
      const params = {
        t: 'movie',
        q: `${query} ${year || ''} ${quality || ''}`.trim(),
        limit: '50'
      };

      const response = await this.client.get('/api', { params });
      
      return new Promise((resolve, reject) => {
        parseString(response.data, (err, result) => {
          if (err) {
            Logger.error('XML parsing failed:', err);
            reject(new Error('Failed to parse NZBHydra response'));
            return;
          }

          if (!result.rss?.channel?.[0]?.item) {
            resolve([]);
            return;
          }

          const items = result.rss.channel[0].item.map((item: any) => {
            const getAttrValue = (name: string) => {
              const attr = item['newznab:attr']?.find((a: any) => a.$.name === name);
              return attr?.$?.value || '';
            };

            return {
              title: item.title[0],
              size: parseInt(item.size[0]) || 0,
              indexer: getAttrValue('hydraIndexerName') || 'Unknown',
              guid: item.guid[0]._,
              category: item.category[0],
              details: item.description[0],
              downloadType: getAttrValue('category') || 'Unknown'
            };
          });

          resolve(items);
        });
      });
    } catch (error) {
      Logger.error('NZBHydra search failed:', error);
      throw new Error('Failed to search NZBHydra');
    }
  }

  async getNzbUrl(guid: string): Promise<string> {
    return `${env.NZBHYDRA_URL}/getnzb/api/${guid}?apikey=${env.NZBHYDRA_API_KEY}`;
  }
}
