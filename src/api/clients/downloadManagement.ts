import { DelugeClient } from './delugeClient';

export class DownloadManager {
  private delugeClient: DelugeClient;

  constructor(delugeClient: DelugeClient) {
    this.delugeClient = delugeClient;
  }

  /**
   * Lists all completed torrents in Deluge
   */
  async listCompletedTorrents(): Promise<Array<{id: string, name: string}>> {
    try {
      const torrents = await this.delugeClient.getTorrents();
      return torrents
        .filter(torrent => 
          torrent.progress === 100 && 
          (torrent.state === 'Seeding' || torrent.state === 'Paused')
        )
        .map(torrent => ({
          id: torrent.id,
          name: torrent.name
        }));
    } catch (error) {
      console.error('Error listing completed torrents:', error);
      throw new Error('Failed to list completed torrents from Deluge');
    }
  }

  /**
   * Gets files for a specific torrent
   * @param torrentId The ID of the torrent
   */
  async getTorrentFiles(torrentId: string): Promise<Array<{path: string, size: number}>> {
    try {
      return await this.delugeClient.getTorrentFiles(torrentId);
    } catch (error) {
      console.error(`Error getting files for torrent ${torrentId}:`, error);
      throw new Error(`Failed to get files for torrent: ${torrentId}`);
    }
  }

  /**
   * Searches for torrents matching the given query
   * @param query Search term to look for in torrent names
   */
  async searchTorrents(query: string): Promise<Array<{id: string, name: string}>> {
    try {
      const torrents = await this.listCompletedTorrents();
      return torrents.filter(torrent => 
        torrent.name.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching torrents:', error);
      throw new Error('Failed to search torrents in Deluge');
    }
  }

  /**
   * Gets detailed information for a specific torrent
   * @param torrentId The ID of the torrent
   */
  async getTorrentInfo(torrentId: string): Promise<{save_path?: string, name?: string} | null> {
    try {
      // Use the DelugeClient's sendRequest method to get torrent status with save_path
      const result = await (this.delugeClient as any).sendRequest('web.get_torrent_status', [
        torrentId,
        ['name', 'save_path']
      ]);
      
      return result || null;
    } catch (error) {
      console.error(`Error getting torrent info for ${torrentId}:`, error);
      return null;
    }
  }
}
