"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadManager = void 0;
class DownloadManager {
    delugeClient;
    constructor(delugeClient) {
        this.delugeClient = delugeClient;
    }
    async listCompletedTorrents() {
        try {
            const torrents = await this.delugeClient.getTorrents();
            return torrents
                .filter(torrent => torrent.progress === 100 &&
                (torrent.state === 'Seeding' || torrent.state === 'Paused'))
                .map(torrent => ({
                id: torrent.id,
                name: torrent.name
            }));
        }
        catch (error) {
            console.error('Error listing completed torrents:', error);
            throw new Error('Failed to list completed torrents from Deluge');
        }
    }
    async getTorrentFiles(torrentId) {
        try {
            return await this.delugeClient.getTorrentFiles(torrentId);
        }
        catch (error) {
            console.error(`Error getting files for torrent ${torrentId}:`, error);
            throw new Error(`Failed to get files for torrent: ${torrentId}`);
        }
    }
    async searchTorrents(query) {
        try {
            const torrents = await this.listCompletedTorrents();
            return torrents.filter(torrent => torrent.name.toLowerCase().includes(query.toLowerCase()));
        }
        catch (error) {
            console.error('Error searching torrents:', error);
            throw new Error('Failed to search torrents in Deluge');
        }
    }
}
exports.DownloadManager = DownloadManager;
//# sourceMappingURL=downloadManagement.js.map