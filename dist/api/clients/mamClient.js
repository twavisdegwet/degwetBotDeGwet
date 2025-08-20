"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MamClient = void 0;
const axios_1 = __importDefault(require("axios"));
const zod_1 = require("zod");
const FreeleechResponseSchema = zod_1.z.object({
    Success: zod_1.z.boolean().optional(),
    Error: zod_1.z.string().optional()
});
const MamTorrentSchema = zod_1.z.object({
    id: zod_1.z.number(),
    title: zod_1.z.string(),
    main_cat: zod_1.z.number(),
    category: zod_1.z.number(),
    catname: zod_1.z.string(),
    size: zod_1.z.string(),
    numfiles: zod_1.z.number(),
    seeders: zod_1.z.number(),
    leechers: zod_1.z.number(),
    times_completed: zod_1.z.number(),
    vip: zod_1.z.number(),
    free: zod_1.z.number(),
    fl_vip: zod_1.z.number(),
    personal_freeleech: zod_1.z.number().optional(),
    author_info: zod_1.z.string(),
    narrator_info: zod_1.z.string(),
    series_info: zod_1.z.string(),
    filetype: zod_1.z.string(),
    language: zod_1.z.number().optional(),
    lang_code: zod_1.z.string().optional(),
    w: zod_1.z.number().optional(),
    tags: zod_1.z.string().optional(),
    added: zod_1.z.string().optional(),
    browseflags: zod_1.z.number().optional(),
    comments: zod_1.z.number().optional(),
    owner_name: zod_1.z.string().optional(),
    owner: zod_1.z.number().optional(),
    bookmarked: zod_1.z.any().optional(),
    my_snatched: zod_1.z.number().optional(),
    cat: zod_1.z.string().optional()
});
const MamSearchResponseSchema = zod_1.z.object({
    data: zod_1.z.array(MamTorrentSchema),
    total: zod_1.z.number(),
    found: zod_1.z.number()
});
class MamClient {
    axiosInstance;
    constructor(baseUrl, cookie) {
        const formattedCookie = cookie.includes('mam_id=') ? cookie : `mam_id=${cookie}`;
        this.axiosInstance = axios_1.default.create({
            baseURL: baseUrl,
            headers: {
                'Cookie': formattedCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
    }
    async searchTorrents(params) {
        try {
            const searchPayload = new URLSearchParams();
            if (params.text) {
                searchPayload.append('tor[text]', params.text);
            }
            if (params.srchIn) {
                params.srchIn.forEach(field => {
                    searchPayload.append(`tor[srchIn][${field}]`, 'true');
                });
            }
            if (params.searchType) {
                searchPayload.append('tor[searchType]', params.searchType);
            }
            if (params.searchIn) {
                searchPayload.append('tor[searchIn]', params.searchIn);
            }
            if (params.cat) {
                params.cat.forEach(val => searchPayload.append('tor[cat][]', val));
            }
            if (params.sortType) {
                searchPayload.append('tor[sortType]', params.sortType);
            }
            if (params.startNumber !== undefined) {
                searchPayload.append('tor[startNumber]', params.startNumber.toString());
            }
            if (params.perpage !== undefined) {
                searchPayload.append('perpage', params.perpage.toString());
            }
            if (params.browseFlagsHideVsShow !== undefined) {
                searchPayload.append('tor[browseFlagsHideVsShow]', params.browseFlagsHideVsShow.toString());
            }
            if (params.minSize !== undefined) {
                searchPayload.append('tor[minSize]', params.minSize.toString());
            }
            if (params.maxSize !== undefined) {
                searchPayload.append('tor[maxSize]', params.maxSize.toString());
            }
            if (params.unit !== undefined) {
                searchPayload.append('tor[unit]', params.unit.toString());
            }
            if (params.minSeeders !== undefined) {
                searchPayload.append('tor[minSeeders]', params.minSeeders.toString());
            }
            if (params.maxSeeders !== undefined) {
                searchPayload.append('tor[maxSeeders]', params.maxSeeders.toString());
            }
            if (params.minLeechers !== undefined) {
                searchPayload.append('tor[minLeechers]', params.minLeechers.toString());
            }
            if (params.maxLeechers !== undefined) {
                searchPayload.append('tor[maxLeechers]', params.maxLeechers.toString());
            }
            if (params.minSnatched !== undefined) {
                searchPayload.append('tor[minSnatched]', params.minSnatched.toString());
            }
            if (params.maxSnatched !== undefined) {
                searchPayload.append('tor[maxSnatched]', params.maxSnatched.toString());
            }
            const response = await this.axiosInstance.post('/tor/js/loadSearchJSONbasic.php', searchPayload);
            console.log('Raw MAM search response:', JSON.stringify(response.data, null, 2));
            if (response.data && response.data.error &&
                response.data.error.includes("Nothing returned, out of")) {
                return {
                    data: [],
                    total: 0,
                    found: 0
                };
            }
            if (response.data && response.data.error) {
                throw new Error(`MAM API error: ${response.data.error}`);
            }
            const validatedResponse = MamSearchResponseSchema.parse(response.data);
            return validatedResponse;
        }
        catch (error) {
            console.error('Error searching torrents:', error);
            if (error instanceof zod_1.z.ZodError) {
                console.error('Validation errors:', error.errors);
            }
            throw new Error(`Failed to search torrents: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async setFreeleech(torrentId) {
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const freeleechUrl = `/json/bonusBuy.php/${timestamp}`;
            const response = await this.axiosInstance.get(freeleechUrl, {
                params: {
                    spendtype: 'personalFL',
                    torrentid: torrentId.toString(),
                    timestamp: timestamp.toString()
                }
            });
            if (response.data && response.data.Success) {
                console.log(`Successfully used freeleech wedge for torrent ${torrentId}`);
                return { success: true };
            }
            else if (response.data && response.data.Error) {
                const error = response.data.Error;
                if (error.toLowerCase().includes("this torrent is vip")) {
                    console.log(`Torrent ${torrentId} is already VIP, continuing download`);
                    return { success: true };
                }
                else if (error.toLowerCase().includes("this is already a personal freeleech")) {
                    console.log(`Torrent ${torrentId} is already a personal freeleech, continuing download`);
                    return { success: true };
                }
                else {
                    console.warn(`Failed to purchase freeleech wedge for ${torrentId}: ${error}`);
                    return { success: false, error };
                }
            }
            return { success: false, error: 'Unknown response format' };
        }
        catch (error) {
            console.error('Error setting freeleech:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: errorMessage };
        }
    }
    async getTorrentDownloadUrl(torrentId) {
        try {
            const response = await this.axiosInstance.get(`/t/${torrentId}`);
            const html = response.data;
            const downloadMatch = html.match(/href="\/tor\/download\.php\/([^"]+)"/);
            if (downloadMatch && downloadMatch[1]) {
                return `${this.axiosInstance.defaults.baseURL}/tor/download.php/${downloadMatch[1]}`;
            }
            else {
                return `${this.axiosInstance.defaults.baseURL}/tor/download.php?tid=${torrentId}`;
            }
        }
        catch (error) {
            console.error('Error getting download URL:', error);
            return `${this.axiosInstance.defaults.baseURL}/tor/download.php?tid=${torrentId}`;
        }
    }
    async getTorrentDetails(id) {
        try {
            const dummyTorrent = {
                id: parseInt(id),
                title: 'Sample Torrent',
                main_cat: 14,
                category: 100,
                catname: 'E-Books',
                size: '1024',
                numfiles: 1,
                seeders: 5,
                leechers: 2,
                times_completed: 10,
                vip: 0,
                free: 1,
                fl_vip: 0,
                author_info: '{}',
                narrator_info: '{}',
                series_info: '{}',
                filetype: 'PDF'
            };
            return dummyTorrent;
        }
        catch (error) {
            console.error('Error getting torrent details:', error);
            throw new Error(`Failed to get torrent details: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    formatTorrentForDisplay(torrent) {
        let author = '';
        let narrator = '';
        let series = '';
        try {
            const authorInfo = JSON.parse(torrent.author_info);
            author = Object.values(authorInfo)[0] || '';
        }
        catch (e) {
            author = torrent.author_info.replace(/[{}]/g, '');
        }
        try {
            const narratorInfo = JSON.parse(torrent.narrator_info);
            narrator = Object.values(narratorInfo)[0] || '';
        }
        catch (e) {
            narrator = torrent.narrator_info.replace(/[{}]/g, '');
        }
        try {
            const seriesInfo = JSON.parse(torrent.series_info);
            series = Object.values(seriesInfo)[0] || '';
        }
        catch (e) {
            series = torrent.series_info.replace(/[{}]/g, '');
        }
        return {
            id: torrent.id,
            title: torrent.title,
            size: torrent.size,
            seeders: torrent.seeders,
            leechers: torrent.leechers,
            category: torrent.category,
            completions: torrent.times_completed,
            isFree: torrent.free === 1 || torrent.fl_vip === 1 || torrent.personal_freeleech === 1,
            isVip: torrent.vip === 1,
            author: author,
            narrator: narrator,
            series: series
        };
    }
    isTorrentFree(torrent) {
        return torrent.free === 1 || torrent.fl_vip === 1 || torrent.personal_freeleech === 1;
    }
}
exports.MamClient = MamClient;
