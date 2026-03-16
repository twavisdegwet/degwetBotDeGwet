import axios, { AxiosInstance } from 'axios';
import { Logger } from '../../shared/logger';
import { env } from '../../config/env';

export class SABnzbdClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.SABNZBD_URL,
      timeout: 10000,
      params: {
        apikey: env.SABNZBD_API_KEY,
        output: 'json'
      }
    });
  }

  async addNzb(nzbUrl: string, category: string): Promise<void> {
    try {
      await this.client.get('/api', {
        params: {
          mode: 'addurl',
          name: nzbUrl,
          cat: category
        }
      });
    } catch (error) {
      Logger.error('SABnzbd add failed:', error);
      throw new Error('Failed to add NZB to SABnzbd');
    }
  }
}
