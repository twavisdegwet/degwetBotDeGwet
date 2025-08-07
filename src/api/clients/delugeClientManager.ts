import { DelugeClient } from './delugeClient';

/**
 * Singleton manager for DelugeClient to avoid authentication conflicts
 */
class DelugeClientManager {
  private static instance: DelugeClientManager;
  private delugeClient: DelugeClient | null = null;
  private baseUrl: string = '';
  private password: string = '';

  private constructor() {}

  public static getInstance(): DelugeClientManager {
    if (!DelugeClientManager.instance) {
      DelugeClientManager.instance = new DelugeClientManager();
    }
    return DelugeClientManager.instance;
  }

  public initialize(baseUrl: string, password: string): void {
    this.baseUrl = baseUrl;
    this.password = password;
    // Don't create the client here, create it lazily
    this.delugeClient = null;
  }

  public async getClient(): Promise<DelugeClient> {
    if (!this.delugeClient) {
      // Fallback to environment variables if not initialized
      if (!this.baseUrl || !this.password) {
        console.warn('DelugeClientManager not initialized with baseUrl or password, attempting to use environment variables as fallback.');
        try {
          // Dynamic import to avoid circular dependency issues
          const { env } = await import('../../config/env');
          this.baseUrl = this.baseUrl || env.DELUGE_URL;
          this.password = this.password || env.DELUGE_PASSWORD;
          console.log(`Using Deluge URL from environment: ${this.baseUrl}`);
        } catch (error) {
          console.error('Failed to load environment variables for Deluge fallback:', error);
          throw new Error('DelugeClientManager not initialized and failed to load environment fallback. Please check configuration.');
        }
      }
      
      if (!this.baseUrl || !this.password) {
        throw new Error('DelugeClientManager not initialized with valid baseUrl or password, and no fallback available.');
      }
      
      console.log(`Initializing DelugeClient with base URL: ${this.baseUrl}`);
      this.delugeClient = new DelugeClient(this.baseUrl, this.password);
      // Login immediately when creating the client
      await this.delugeClient.login();
    }
    return this.delugeClient;
  }

  public reset(): void {
    this.delugeClient = null;
  }
}

export default DelugeClientManager;
