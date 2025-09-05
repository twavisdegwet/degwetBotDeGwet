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
  pubDate: Date;
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

  async searchMovies(query: string, quality?: string): Promise<NZBHydraSearchResult[]> {
    try {
      // Build query with quality preference and 1080p 5.1 filter
      let searchQuery = query;
      
      // Add quality preference if provided
      if (quality) {
        searchQuery += ` ${quality}`;
      }
      
      // Always add 1080p 5.1 filter for movies
      searchQuery += ' 1080p 5.1';
      
      // First try with "1080p 5.1" filter
      let params = {
        t: 'movie',
        q: searchQuery.trim(),
        limit: '50'
      };

      let response = await this.client.get('/api', { params });
      let items = await this.parseSearchResults(response.data);

      // If no results found with "1080p 5.1", try without it
      if (items.length === 0) {
        // Remove the 1080p 5.1 filter but keep quality preference
        searchQuery = `${query} ${quality || ''}`.trim();
        params = {
          t: 'movie',
          q: searchQuery.trim(),
          limit: '50'
        };

        response = await this.client.get('/api', { params });
        items = await this.parseSearchResults(response.data);
      }

      // Filter to only include movie category results
      const movieItems = items.filter(item => 
        item.category.includes('Movies') || 
        item.downloadType.includes('Movies')
      );

      return movieItems;
    } catch (error) {
      Logger.error('NZBHydra search failed:', error);
      throw new Error('Failed to search NZBHydra');
    }
  }

  private parseSearchResults(xmlData: string): Promise<NZBHydraSearchResult[]> {
    return new Promise((resolve, reject) => {
      parseString(xmlData, (err, result) => {
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

          // Parse the publication date
          const pubDate = item.pubDate?.[0] ? new Date(item.pubDate[0]) : new Date(0);

          return {
            title: item.title[0],
            size: parseInt(item.size[0]) || 0,
            indexer: getAttrValue('hydraIndexerName') || 'Unknown',
            guid: item.guid[0]._,
            category: item.category?.[0] || 'Unknown',
            details: item.description?.[0] || '',
            downloadType: getAttrValue('category') || 'Unknown',
            pubDate: pubDate
          };
        });

        // Sort by publication date (newest first)
        items.sort((a: NZBHydraSearchResult, b: NZBHydraSearchResult) => b.pubDate.getTime() - a.pubDate.getTime());

        resolve(items);
      });
    });
  }

  async getNzbUrl(guid: string): Promise<string> {
    return `${env.NZBHYDRA_URL}/getnzb/api/${guid}?apikey=${env.NZBHYDRA_API_KEY}`;
  }
}
