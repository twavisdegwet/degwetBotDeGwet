import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';

// Define Zod schemas for response validation
const DelugeTorrentStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  progress: z.number(),
  download_payload_rate: z.number(),
  eta: z.number()
});

export type DelugeTorrentStatus = z.infer<typeof DelugeTorrentStatusSchema>;

export class DelugeClient {
  private axiosInstance: AxiosInstance;
  private password: string;
  private isAuthenticated: boolean = false;
  private sessionCookies: string = '';


  constructor(baseUrl: string, password: string) {
    this.password = password;
    this.axiosInstance = axios.create({
      baseURL: baseUrl.endsWith('/') ? baseUrl : baseUrl + '/',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add response interceptor to handle auth errors and capture cookies
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Capture cookies from response
        if (response.headers['set-cookie']) {
          this.sessionCookies = response.headers['set-cookie'].join('; ');
        }
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          this.isAuthenticated = false;
          this.sessionCookies = '';
        }
        return Promise.reject(error);
      }
    );

    // Add request interceptor to send cookies
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.sessionCookies) {
          config.headers['Cookie'] = this.sessionCookies;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Ensure we're authenticated with Deluge web interface
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated) {
      await this.login();
    }
  }


  /**
   * Send a JSON-RPC request to Deluge
   */
  private async sendRequest(method: string, params: any[] = []): Promise<any> {
    try {
      // Ensure we're authenticated before sending any request
      await this.ensureAuthenticated();
      
      const response = await this.axiosInstance.post('json', {
        id: Date.now(),
        method,
        params
      });

      if (response.data && response.data.error) {
        throw new Error(`Deluge RPC error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error) {
      // If we get an authentication error, reset authentication state and re-throw
      if (error instanceof Error && error.message.includes('Not authenticated')) {
        this.isAuthenticated = false;
      }
      
      console.error('Error sending Deluge request:', error);
      throw new Error(`Failed to communicate with Deluge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Login to Deluge
   */
  async login(): Promise<boolean> {
    try {
      // Reset authentication state
      this.isAuthenticated = false;
      
      // Don't use sendRequest for login to avoid circular dependency
      const response = await this.axiosInstance.post('json', {
        id: Date.now(),
        method: 'auth.login',
        params: [this.password]
      });

      // Check if we got a JSON response
      if (typeof response.data === 'object' && response.data !== null) {
        if (response.data.error) {
          throw new Error(`Deluge RPC error: ${response.data.error.message}`);
        }

        this.isAuthenticated = response.data.result === true;
        console.log('Deluge login successful:', this.isAuthenticated);
        
        if (this.isAuthenticated) {
          // After successful login, connect to the daemon
          await this.connectToDaemon();
        }
        
        return this.isAuthenticated;
      } else {
        this.isAuthenticated = false;
        return false;
      }
    } catch (error) {
      console.error('Error logging into Deluge:', error);
      this.isAuthenticated = false;
      throw new Error(`Failed to login to Deluge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Connect to the daemon after authentication
   */
  private async connectToDaemon(): Promise<void> {
    try {
      // Get available hosts
      const hostsResponse = await this.axiosInstance.post('json', {
        id: Date.now(),
        method: 'web.get_hosts',
        params: []
      });

      if (hostsResponse.data && hostsResponse.data.error) {
        throw new Error(`Failed to get hosts: ${hostsResponse.data.error.message}`);
      }

      const hosts = hostsResponse.data.result;
      if (!hosts || hosts.length === 0) {
        throw new Error('No daemon hosts available');
      }

      // Connect to the first available host (usually the local daemon)
      const hostId = hosts[0][0]; // Host ID is the first element
      console.log(`Connecting to daemon host: ${hostId}`);
      
      const connectResponse = await this.axiosInstance.post('json', {
        id: Date.now(),
        method: 'web.connect',
        params: [hostId]
      });

      if (connectResponse.data && connectResponse.data.error) {
        throw new Error(`Failed to connect to daemon: ${connectResponse.data.error.message}`);
      }

      console.log('Successfully connected to Deluge daemon');
    } catch (error) {
      console.error('Error connecting to daemon:', error);
      throw new Error(`Failed to connect to daemon: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Download a torrent from URL with proper cookie authentication
   */
  async downloadTorrentFromUrl(url: string, cookie?: string, torrentName?: string): Promise<string> {
    try {
      // Ensure we're authenticated first
      if (!this.isAuthenticated) {
        await this.login();
      }
      
      // If torrentName is provided, check for duplicates
      if (torrentName) {
        const existingTorrent = await this.getTorrentByName(torrentName);
        if (existingTorrent) {
          console.log(`Torrent "${torrentName}" already exists in Deluge`);
          return existingTorrent.id;
        }
      }
      
      // If we have a cookie, we need to download the torrent file ourselves first
      // because Deluge's web.download_torrent_from_url doesn't support custom headers
      if (cookie) {
        console.log('Downloading torrent file with authentication...');
        
        try {
          // Download the torrent file with proper authentication
          const torrentResponse = await axios.get(url, {
            headers: {
              'Cookie': cookie.startsWith('mam_id=') ? cookie : `mam_id=${cookie}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/x-bittorrent, */*',
              'Referer': 'https://www.myanonamouse.net/'
            },
            responseType: 'arraybuffer',
            timeout: 30000,
            maxRedirects: 5
          });
          
          // Validate that we got actual torrent data
          const responseData = torrentResponse.data;
          if (!responseData || responseData.length === 0) {
            throw new Error('Downloaded file is empty');
          }
          
          // Check if it's a torrent file (starts with d8:announce or similar)
          const dataStart = Buffer.from(responseData).slice(0, 20).toString('utf8');
          if (!dataStart.includes('announce') && !dataStart.startsWith('d')) {
            // Check if we got an HTML error page instead
            const fullText = Buffer.from(responseData).toString('utf8');
            if (fullText.includes('<!DOCTYPE') || fullText.includes('<html')) {
              console.error('Received HTML instead of torrent file - authentication may have failed');
              throw new Error('Authentication failed - received HTML page instead of torrent file');
            }
            throw new Error('Downloaded file does not appear to be a valid torrent');
          }
          
          // Convert the torrent data to base64 for Deluge
          const torrentData = Buffer.from(responseData).toString('base64');
          
          console.log(`Torrent file downloaded successfully, size: ${responseData.length} bytes`);
          
          // Use the core.add_torrent_file method - this is the most reliable method
          // based on testing, web.add_torrents fails with path: null
          console.log(`Adding torrent to Deluge using core.add_torrent_file...`);
          console.log(`Download location: /mnt/nas/nzb/completed/torrent`);
          
          const tempFilename = `discord_torrent_${Date.now()}.torrent`;
          try {
            const response = await this.axiosInstance.post('json', {
              id: Date.now(),
              method: 'core.add_torrent_file',
              params: [
                tempFilename,
                torrentData,
                {
                  download_location: '/mnt/nas/nzb/completed/torrent',
                  move_completed: true,
                  move_completed_path: '/mnt/nas/nzb/completed/torrent',
                  add_paused: false
                }
              ]
            });

            // Check for errors first
            if (response.data && response.data.error) {
              console.log('❌ Deluge error:', response.data.error);
              throw new Error(`Deluge RPC error: ${response.data.error.message}`);
            }

            // The result should be the torrent hash/ID
            const result = response.data.result;
            if (result && typeof result === 'string' && result.length === 40) {
              console.log(`✅ Successfully added torrent to Deluge with hash: ${result}`);
              return result;
            } else {
              console.log('❌ Unexpected response from Deluge:', response.data);
              throw new Error('No valid torrent ID returned from Deluge');
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes('Torrent already in session')) {
              const err = new Error('Torrent already exists in Deluge') as any;
              err.code = 'DUPLICATE_TORRENT';
              // More robust hash extraction - look for 40-character hex strings in parentheses
              const hashMatch = error.message.match(/\(([a-f0-9]{40})\)/);
              err.hash = hashMatch ? hashMatch[1] : null;
              console.log(`Extracted torrent hash: ${err.hash}`);
              throw err;
            }
            throw error;
          }
        } catch (downloadError) {
          console.error('Error downloading torrent file:', downloadError);
          
          // If download with cookie failed, try without cookie as fallback
          if (downloadError instanceof Error && downloadError.message.includes('Authentication failed')) {
            console.log('Attempting download without authentication as fallback...');
            return this.downloadTorrentFromUrl(url, undefined, torrentName);
          }
          
          throw downloadError;
        }
      } else {
        // No cookie provided, use the standard method
        const response = await this.axiosInstance.post('json', {
          id: Date.now(),
          method: 'web.download_torrent_from_url',
          params: [url]
        });

        if (response.data && response.data.error) {
          // If we get a 401 error, try to re-authenticate once
          if (response.data.error.message && response.data.error.message.includes('401 Unauthorized')) {
            console.log('Got 401 error, attempting re-authentication...');
            await this.login();
            
            // Retry the request
            const retryResponse = await this.axiosInstance.post('json', {
              id: Date.now(),
              method: 'web.download_torrent_from_url',
              params: [url]
            });
            
            if (retryResponse.data && retryResponse.data.error) {
              throw new Error(`Deluge RPC error: ${retryResponse.data.error.message}`);
            }
            
            return retryResponse.data.result;
          } else {
            throw new Error(`Deluge RPC error: ${response.data.error.message}`);
          }
        }

        return response.data.result;
      }
} catch (error) {
  console.error('Error downloading torrent from URL:', error);
  throw error;
}
  }

  /**
   * Add a torrent using base64 data (filedump)
   */
  async addTorrentFromData(torrentData: string, options?: any): Promise<string> {
    try {
      const defaultOptions = {
        download_location: '/mnt/nas/nzb/completed/torrent',
        move_completed: true,
        move_completed_path: '/mnt/nas/nzb/completed/torrent',
        add_paused: false
      };

      // Use core.add_torrent_file method - more reliable than web.add_torrents
      const tempFilename = `temp_torrent_${Date.now()}.torrent`;
      
      const result = await this.sendRequest('core.add_torrent_file', [
        tempFilename,
        torrentData,
        { ...defaultOptions, ...options }
      ]);
      
      if (result && typeof result === 'string' && result.length === 40) {
        console.log(`✅ Successfully added torrent to Deluge with hash: ${result}`);
        return result;
      } else {
        throw new Error('No valid torrent ID returned from Deluge');
      }
    } catch (error) {
      console.error('Error adding torrent from data:', error);
      throw new Error(`Failed to add torrent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get torrent status by ID
   */
  async getTorrentStatus(id: string): Promise<DelugeTorrentStatus> {
    try {
      // Use update_ui to get current status information
      const result = await this.sendRequest('web.update_ui', [['name', 'state', 'progress', 'download_payload_rate', 'eta'], {}]);
      
      // Find the specific torrent in the results
      if (result && result.torrents) {
        // The torrents object has torrent IDs as keys
        const torrent = result.torrents[id];
        if (torrent) {
          return {
            id: id,
            name: torrent.name || 'Unknown',
            state: torrent.state || 'Unknown',
            progress: torrent.progress || 0,
            download_payload_rate: torrent.download_payload_rate || 0,
            eta: torrent.eta || 0
          };
        }
      }
      
      // Return dummy data if not found
      return {
        id,
        name: 'Torrent not found',
        state: 'Not Found',
        progress: 0,
        download_payload_rate: 0,
        eta: 0
      };
    } catch (error) {
      console.error('Error getting torrent status:', error);
      throw new Error(`Failed to get torrent status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get torrent by name
   */
  async getTorrentByName(name: string): Promise<any | null> {
    try {
      const result = await this.sendRequest('web.update_ui', [['name', 'state', 'progress', 'download_payload_rate', 'eta'], {}]);
      
      if (result && result.torrents) {
        for (const id in result.torrents) {
          if (result.torrents[id].name === name) {
            return {
              id,
              ...result.torrents[id]
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding torrent by name:', error);
      throw new Error(`Failed to find torrent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all torrents
   */
  async getTorrents(): Promise<any[]> {
    try {
      const result = await this.sendRequest('web.update_ui', [['name', 'state', 'progress', 'download_payload_rate', 'eta', 'files'], {}]);
      
      if (result && result.torrents) {
        // Convert the torrents object to an array with IDs
        const torrentsArray = Object.keys(result.torrents).map(id => ({
          id,
          ...result.torrents[id]
        }));
        return torrentsArray;
      }
      
      return [];
    } catch (error) {
      console.error('Error getting torrents:', error);
      throw new Error(`Failed to get torrents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get files for a specific torrent
   * @param torrentId The ID of the torrent
   */
  async getTorrentFiles(torrentId: string): Promise<Array<{path: string, size: number}>> {
    try {
      // Get detailed information about the torrent including files
      const result = await this.sendRequest('web.get_torrent_status', [
        torrentId,
        ['name', 'files', 'save_path']
      ]);

      if (result && result.files) {
        // The files array contains objects with 'path' and 'size' properties
        return result.files.map((file: any) => ({
          path: file.path,
          size: file.size
        }));
      }

      return [];
    } catch (error) {
      console.error('Error getting torrent files:', error);
      throw new Error(`Failed to get torrent files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
