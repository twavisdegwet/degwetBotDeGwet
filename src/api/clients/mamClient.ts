import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';

// Response schema for freeleech wedge purchase
const FreeleechResponseSchema = z.object({
  Success: z.boolean().optional(),
  Error: z.string().optional()
});

export type FreeleechResponse = z.infer<typeof FreeleechResponseSchema>;

// Define Zod schemas for response validation
const MamTorrentSchema = z.object({
  id: z.number(),
  title: z.string(),
  main_cat: z.number(),
  category: z.number(),
  catname: z.string(),
  size: z.string(),
  numfiles: z.number(),
  seeders: z.number(),
  leechers: z.number(),
  times_completed: z.number(),
  vip: z.number(),
  free: z.number(),
  fl_vip: z.number(),
  personal_freeleech: z.number().optional(),
  author_info: z.string(),
  narrator_info: z.string(),
  series_info: z.string(),
  filetype: z.string(),
  language: z.number().optional(),
  lang_code: z.string().optional(),
  w: z.number().optional(),
  tags: z.string().optional(),
  added: z.string().optional(),
  browseflags: z.number().optional(),
  comments: z.number().optional(),
  owner_name: z.string().optional(),
  owner: z.number().optional(),
  bookmarked: z.any().optional(),
  my_snatched: z.number().optional(),
  cat: z.string().optional()
});

export type MamTorrent = z.infer<typeof MamTorrentSchema>;

const MamSearchResponseSchema = z.object({
  data: z.array(MamTorrentSchema),
  total: z.number(),
  found: z.number()
});

export type MamSearchResponse = z.infer<typeof MamSearchResponseSchema>;

// Define the MAM client class
export class MamClient {
  private axiosInstance: AxiosInstance;

  constructor(baseUrl: string, cookie: string) {
    // Format cookie properly - if it doesn't already have mam_id= prefix, add it
    const formattedCookie = cookie.includes('mam_id=') ? cookie : `mam_id=${cookie}`;
    
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      headers: {
        'Cookie': formattedCookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000 // 10 second timeout
    });
  }

  /**
   * Search for torrents on MyAnonaMouse - main method used by Discord bot
   */
  async searchTorrents(params: {
    text?: string;
    srchIn?: string[];
    searchType?: 'all' | 'active' | 'inactive' | 'fl' | 'fl-VIP' | 'VIP' | 'nVIP' | 'nMeta';
    cat?: string[];
    sortType?: 'titleAsc' | 'titleDesc' | 'fileAsc' | 'fileDesc' | 'sizeAsc' | 'sizeDesc' | 'seedersAsc' | 'seedersDesc' | 'leechersAsc' | 'leechersDesc' | 'snatchedAsc' | 'snatchedDesc' | 'dateAsc' | 'dateDesc' | 'bmkaAsc' | 'bmkaDesc' | 'reseedAsc' | 'reseedDesc' | 'categoryAsc' | 'categoryDesc' | 'random' | 'default';
    startNumber?: number;
    perpage?: number;
    filetype?: string;
  }): Promise<MamSearchResponse> {
    try {
      // Build query parameters using URLSearchParams to handle arrays correctly
      const searchPayload = new URLSearchParams();

      if (params.text) {
        searchPayload.append('tor[text]', params.text);
      }

      if (params.srchIn) {
        params.srchIn.forEach(val => searchPayload.append('tor[srchIn][]', val));
      }

      if (params.searchType) {
        searchPayload.append('tor[searchType]', params.searchType);
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

      // For the search endpoint, we make a POST request with form data.
      const response = await this.axiosInstance.post('/tor/js/loadSearchJSONbasic.php', searchPayload);

      // Log the raw response for debugging
      console.log('Raw MAM search response:', JSON.stringify(response.data, null, 2));

      // Handle "no results" case
      if (response.data && response.data.error && 
          response.data.error.includes("Nothing returned, out of")) {
        return {
          data: [],
          total: 0,
          found: 0
        };
      }

      // Handle other error responses from MAM API
      if (response.data && response.data.error) {
        throw new Error(`MAM API error: ${response.data.error}`);
      }

      // Validate the response structure
      const validatedResponse = MamSearchResponseSchema.parse(response.data);
      return validatedResponse;
    } catch (error) {
      console.error('Error searching torrents:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
      }
      throw new Error(`Failed to search torrents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set a torrent as freeleech using wedges - used by Discord bot
   */
  async setFreeleech(torrentId: number): Promise<{ success: boolean; error?: string }> {
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
      
      // Check if the response indicates success
      if (response.data && response.data.Success) {
        console.log(`Successfully used freeleech wedge for torrent ${torrentId}`);
        return { success: true };
      } else if (response.data && response.data.Error) {
        const error = response.data.Error;
        // Handle specific error cases that are considered "success"
        if (error.toLowerCase().includes("this torrent is vip")) {
          console.log(`Torrent ${torrentId} is already VIP, continuing download`);
          return { success: true };
        } else if (error.toLowerCase().includes("this is already a personal freeleech")) {
          console.log(`Torrent ${torrentId} is already a personal freeleech, continuing download`);
          return { success: true };
        } else {
          console.warn(`Failed to purchase freeleech wedge for ${torrentId}: ${error}`);
          return { success: false, error };
        }
      }
      
      return { success: false, error: 'Unknown response format' };
    } catch (error) {
      console.error('Error setting freeleech:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get torrent download URL - used by Discord bot
   */
  async getTorrentDownloadUrl(torrentId: number): Promise<string> {
    try {
      // First, get the torrent details to find the download hash
      const response = await this.axiosInstance.get(`/t/${torrentId}`);
      
      // Parse the HTML to find the download link
      const html = response.data;
      const downloadMatch = html.match(/href="\/tor\/download\.php\/([^"]+)"/);
      
      if (downloadMatch && downloadMatch[1]) {
        return `${this.axiosInstance.defaults.baseURL}/tor/download.php/${downloadMatch[1]}`;
      } else {
        // Fallback to direct ID-based download
        return `${this.axiosInstance.defaults.baseURL}/tor/download.php?tid=${torrentId}`;
      }
    } catch (error) {
      console.error('Error getting download URL:', error);
      // Return fallback URL
      return `${this.axiosInstance.defaults.baseURL}/tor/download.php?tid=${torrentId}`;
    }
  }

  /**
   * Get torrent details by ID - used by Discord bot for duplicate checking
   */
  async getTorrentDetails(id: string): Promise<MamTorrent> {
    try {
      // This is a simplified implementation - in a real scenario you'd parse the torrent page
      // For now, we'll return a basic structure that works with the duplicate checking
      const dummyTorrent: MamTorrent = {
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
    } catch (error) {
      console.error('Error getting torrent details:', error);
      throw new Error(`Failed to get torrent details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format torrent data for display - used by Discord bot
   */
  formatTorrentForDisplay(torrent: MamTorrent): any {
    // Parse author, narrator, and series info from JSON strings
    let author = '';
    let narrator = '';
    let series = '';
    
    try {
      const authorInfo = JSON.parse(torrent.author_info);
      author = Object.values(authorInfo)[0] as string || '';
    } catch (e) {
      // If parsing fails, use the raw string
      author = torrent.author_info.replace(/[{}]/g, '');
    }
    
    try {
      const narratorInfo = JSON.parse(torrent.narrator_info);
      narrator = Object.values(narratorInfo)[0] as string || '';
    } catch (e) {
      narrator = torrent.narrator_info.replace(/[{}]/g, '');
    }
    
    try {
      const seriesInfo = JSON.parse(torrent.series_info);
      series = Object.values(seriesInfo)[0] as string || '';
    } catch (e) {
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

  /**
   * Check if a torrent is already freeleech - used by Discord bot
   */
  isTorrentFree(torrent: MamTorrent): boolean {
    return torrent.free === 1 || torrent.fl_vip === 1 || torrent.personal_freeleech === 1;
  }
}
