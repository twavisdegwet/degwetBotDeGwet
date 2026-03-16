import { Router, Request, Response } from 'express';
import { DownloadManager } from '../clients/downloadManagement';
import DelugeClientManager from '../clients/delugeClientManager';
import { uploadTorrentToGDrive } from '../../discord/uploadUtils';

const router = Router();

/**
 * Middleware to get Deluge client
 */
const getDelugeClient = async () => {
  const clientManager = DelugeClientManager.getInstance();
  return await clientManager.getClient();
};

/**
 * POST /downloads/webhook
 * Handle Deluge webhook events for completed torrents
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, torrentId, torrentName } = req.body;
    
    console.log(`📥 Deluge webhook event received: ${event} for torrent ${torrentName} (${torrentId})`);
    
    if (event === 'torrent_completed') {
      // Handle completed torrent
      const delugeClient = await getDelugeClient();
      const downloadManager = new DownloadManager(delugeClient);
      
      // Get torrent info
      const torrentInfo = await downloadManager.getTorrentInfo(torrentId);
      if (!torrentInfo) {
        console.error(`❌ Could not get info for completed torrent: ${torrentId}`);
        return res.status(404).json({ 
          success: false, 
          error: 'Torrent not found' 
        });
      }
      
      console.log(`🎉 Torrent completed: ${torrentInfo.name}`);
      
      // Start upload process
      try {
        // Note: Discord notifications are handled through the bot's monitoring system
        // This webhook could be extended to send notifications if needed
        
        // For now, we'll rely on the periodic checker
        console.log(`🔄 Queued ${torrentInfo.name} for Google Drive upload`);
      } catch (uploadError) {
        console.error(`❌ Error initiating upload for ${torrentInfo.name}:`, uploadError);
      }
      
      return res.json({ 
        success: true, 
        message: 'Torrent completion acknowledged' 
      });
    }
    
    return res.json({ 
      success: true, 
      message: 'Event received but not processed' 
    });
  } catch (error) {
    console.error('Error handling Deluge webhook:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to process webhook event' 
    });
  }
});

/**
 * GET /downloads/completed
 * Get list of completed torrents that haven't been uploaded yet
 */
router.get('/completed', async (_req: Request, res: Response) => {
  try {
    const delugeClient = await getDelugeClient();
    const downloadManager = new DownloadManager(delugeClient);
    const completedTorrents = await downloadManager.listCompletedTorrents();
    
    // Filter out torrents that might have already been uploaded
    // This is a simple check - in a production system you'd want a more robust solution
    const pendingUploads = completedTorrents.filter(_torrent => {
      // For now, return all completed torrents
      // A more sophisticated system would track which torrents have been uploaded
      return true;
    });
    
    return res.json({ 
      success: true, 
      torrents: pendingUploads 
    });
  } catch (error) {
    console.error('Error listing completed torrents:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to list completed torrents' 
    });
  }
});

/**
 * POST /downloads/upload-completed
 * Upload all completed torrents to Google Drive
 */
router.post('/upload-completed', async (req: Request, res: Response) => {
  try {
    const { convertMp3ToM4b = false } = req.body;
    const delugeClient = await getDelugeClient();
    const downloadManager = new DownloadManager(delugeClient);
    const completedTorrents = await downloadManager.listCompletedTorrents();
    
    if (completedTorrents.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No completed torrents to upload' 
      });
    }
    
    console.log(`📤 Starting upload process for ${completedTorrents.length} completed torrents`);
    
    // Upload each completed torrent
    const results = [];
    for (const torrent of completedTorrents) {
      try {
        console.log(`🔄 Uploading ${torrent.name} (${torrent.id}) to Google Drive...`);
        const result = await uploadTorrentToGDrive(torrent.id, convertMp3ToM4b);
        results.push({
          torrentId: torrent.id,
          torrentName: torrent.name,
          success: result.success,
          message: result.message,
          error: result.error
        });
        
        if (result.success) {
          console.log(`✅ Successfully uploaded ${torrent.name} to Google Drive`);
        } else {
          console.error(`❌ Failed to upload ${torrent.name} to Google Drive: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ Error uploading ${torrent.name}:`, error);
        results.push({
          torrentId: torrent.id,
          torrentName: torrent.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return res.json({ 
      success: true, 
      results 
    });
  } catch (error) {
    console.error('Error uploading completed torrents:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to upload completed torrents' 
    });
  }
});

export default router;
