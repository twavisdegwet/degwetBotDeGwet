"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelugeClient = void 0;
const axios_1 = __importDefault(require("axios"));
const zod_1 = require("zod");
const DelugeTorrentStatusSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    state: zod_1.z.string(),
    progress: zod_1.z.number(),
    download_payload_rate: zod_1.z.number(),
    eta: zod_1.z.number()
});
class DelugeClient {
    axiosInstance;
    password;
    isAuthenticated = false;
    sessionCookies = '';
    constructor(baseUrl, password) {
        this.password = password;
        this.axiosInstance = axios_1.default.create({
            baseURL: baseUrl.endsWith('/') ? baseUrl : baseUrl + '/',
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        this.axiosInstance.interceptors.response.use((response) => {
            if (response.headers['set-cookie']) {
                this.sessionCookies = response.headers['set-cookie'].join('; ');
            }
            return response;
        }, (error) => {
            if (error.response?.status === 401) {
                this.isAuthenticated = false;
                this.sessionCookies = '';
            }
            return Promise.reject(error);
        });
        this.axiosInstance.interceptors.request.use((config) => {
            if (this.sessionCookies) {
                config.headers['Cookie'] = this.sessionCookies;
            }
            return config;
        }, (error) => {
            return Promise.reject(error);
        });
    }
    async ensureAuthenticated() {
        if (!this.isAuthenticated) {
            await this.login();
        }
    }
    async sendRequest(method, params = []) {
        try {
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
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Not authenticated')) {
                this.isAuthenticated = false;
            }
            console.error('Error sending Deluge request:', error);
            throw new Error(`Failed to communicate with Deluge: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async login() {
        try {
            this.isAuthenticated = false;
            const response = await this.axiosInstance.post('json', {
                id: Date.now(),
                method: 'auth.login',
                params: [this.password]
            });
            if (typeof response.data === 'object' && response.data !== null) {
                if (response.data.error) {
                    throw new Error(`Deluge RPC error: ${response.data.error.message}`);
                }
                this.isAuthenticated = response.data.result === true;
                console.log('Deluge login successful:', this.isAuthenticated);
                return this.isAuthenticated;
            }
            else {
                this.isAuthenticated = false;
                return false;
            }
        }
        catch (error) {
            console.error('Error logging into Deluge:', error);
            this.isAuthenticated = false;
            throw new Error(`Failed to login to Deluge: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async downloadTorrentFromUrl(url, cookie, torrentName) {
        try {
            if (!this.isAuthenticated) {
                await this.login();
            }
            if (torrentName) {
                const existingTorrent = await this.getTorrentByName(torrentName);
                if (existingTorrent) {
                    console.log(`Torrent "${torrentName}" already exists in Deluge`);
                    return existingTorrent.id;
                }
            }
            if (cookie) {
                console.log('Downloading torrent file with authentication...');
                try {
                    const torrentResponse = await axios_1.default.get(url, {
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
                    const responseData = torrentResponse.data;
                    if (!responseData || responseData.length === 0) {
                        throw new Error('Downloaded file is empty');
                    }
                    const dataStart = Buffer.from(responseData).slice(0, 20).toString('utf8');
                    if (!dataStart.includes('announce') && !dataStart.startsWith('d')) {
                        const fullText = Buffer.from(responseData).toString('utf8');
                        if (fullText.includes('<!DOCTYPE') || fullText.includes('<html')) {
                            console.error('Received HTML instead of torrent file - authentication may have failed');
                            throw new Error('Authentication failed - received HTML page instead of torrent file');
                        }
                        throw new Error('Downloaded file does not appear to be a valid torrent');
                    }
                    const torrentData = Buffer.from(responseData).toString('base64');
                    console.log(`Torrent file downloaded successfully, size: ${responseData.length} bytes`);
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
                        if (response.data && response.data.error) {
                            console.log('❌ Deluge error:', response.data.error);
                            throw new Error(`Deluge RPC error: ${response.data.error.message}`);
                        }
                        const result = response.data.result;
                        if (result && typeof result === 'string' && result.length === 40) {
                            console.log(`✅ Successfully added torrent to Deluge with hash: ${result}`);
                            return result;
                        }
                        else {
                            console.log('❌ Unexpected response from Deluge:', response.data);
                            throw new Error('No valid torrent ID returned from Deluge');
                        }
                    }
                    catch (error) {
                        if (error instanceof Error && error.message.includes('Torrent already in session')) {
                            const err = new Error('Torrent already exists in Deluge');
                            err.code = 'DUPLICATE_TORRENT';
                            err.hash = error.message.match(/\(([a-f0-9]+)\)/)?.[1];
                            throw err;
                        }
                        throw error;
                    }
                }
                catch (downloadError) {
                    console.error('Error downloading torrent file:', downloadError);
                    if (downloadError instanceof Error && downloadError.message.includes('Authentication failed')) {
                        console.log('Attempting download without authentication as fallback...');
                        return this.downloadTorrentFromUrl(url, undefined, torrentName);
                    }
                    throw downloadError;
                }
            }
            else {
                const response = await this.axiosInstance.post('json', {
                    id: Date.now(),
                    method: 'web.download_torrent_from_url',
                    params: [url]
                });
                if (response.data && response.data.error) {
                    if (response.data.error.message && response.data.error.message.includes('401 Unauthorized')) {
                        console.log('Got 401 error, attempting re-authentication...');
                        await this.login();
                        const retryResponse = await this.axiosInstance.post('json', {
                            id: Date.now(),
                            method: 'web.download_torrent_from_url',
                            params: [url]
                        });
                        if (retryResponse.data && retryResponse.data.error) {
                            throw new Error(`Deluge RPC error: ${retryResponse.data.error.message}`);
                        }
                        return retryResponse.data.result;
                    }
                    else {
                        throw new Error(`Deluge RPC error: ${response.data.error.message}`);
                    }
                }
                return response.data.result;
            }
        }
        catch (error) {
            console.error('Error downloading torrent from URL:', error);
            throw new Error(`Failed to download torrent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async addTorrentFromData(torrentData, options) {
        try {
            const defaultOptions = {
                download_location: '/mnt/nas/nzb/completed/torrent',
                move_completed: true,
                move_completed_path: '/mnt/nas/nzb/completed/torrent',
                add_paused: false
            };
            const tempFilename = `temp_torrent_${Date.now()}.torrent`;
            const result = await this.sendRequest('core.add_torrent_file', [
                tempFilename,
                torrentData,
                { ...defaultOptions, ...options }
            ]);
            if (result && typeof result === 'string' && result.length === 40) {
                console.log(`✅ Successfully added torrent to Deluge with hash: ${result}`);
                return result;
            }
            else {
                throw new Error('No valid torrent ID returned from Deluge');
            }
        }
        catch (error) {
            console.error('Error adding torrent from data:', error);
            throw new Error(`Failed to add torrent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTorrentStatus(id) {
        try {
            const result = await this.sendRequest('web.update_ui', [['name', 'state', 'progress', 'download_payload_rate', 'eta'], {}]);
            if (result && result.torrents) {
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
            return {
                id,
                name: 'Torrent not found',
                state: 'Not Found',
                progress: 0,
                download_payload_rate: 0,
                eta: 0
            };
        }
        catch (error) {
            console.error('Error getting torrent status:', error);
            throw new Error(`Failed to get torrent status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTorrentByName(name) {
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
        }
        catch (error) {
            console.error('Error finding torrent by name:', error);
            throw new Error(`Failed to find torrent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTorrents() {
        try {
            const result = await this.sendRequest('web.update_ui', [['name', 'state', 'progress', 'download_payload_rate', 'eta', 'files'], {}]);
            if (result && result.torrents) {
                const torrentsArray = Object.keys(result.torrents).map(id => ({
                    id,
                    ...result.torrents[id]
                }));
                return torrentsArray;
            }
            return [];
        }
        catch (error) {
            console.error('Error getting torrents:', error);
            throw new Error(`Failed to get torrents: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getTorrentFiles(torrentId) {
        try {
            const result = await this.sendRequest('web.get_torrent_status', [
                torrentId,
                ['name', 'files', 'save_path']
            ]);
            if (result && result.files) {
                return result.files.map((file) => ({
                    path: file.path,
                    size: file.size
                }));
            }
            return [];
        }
        catch (error) {
            console.error('Error getting torrent files:', error);
            throw new Error(`Failed to get torrent files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
exports.DelugeClient = DelugeClient;
//# sourceMappingURL=delugeClient.js.map