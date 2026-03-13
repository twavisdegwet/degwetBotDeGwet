import { Router, Request, Response } from 'express';
import { UploadManagementClient } from '../clients/uploadManagement';

const router = Router();

// Initialize upload client with service account
const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

const uploadClient = new UploadManagementClient(serviceAccountJson, driveFolderId);


/**
 * GET /uploads/status
 * Check service account status and connectivity
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    // Check if service account JSON is configured
    const serviceAccountConfigured = !!serviceAccountJson;

    // Test Google Drive API access
    const isAuthenticated = await uploadClient.isAuthenticated();

    // Get user info from Google Drive
    let userInfo = null;
    if (isAuthenticated) {
      try {
        userInfo = await uploadClient.getUserInfo();
      } catch (error) {
        console.error('Error getting user info:', error);
      }
    }

    res.json({
      success: true,
      serviceAccountConfigured,
      authenticated: isAuthenticated,
      folderId: driveFolderId,
      user: userInfo?.user || null,
      storage: userInfo?.storageQuota || null
    });
  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check service account status' 
    });
  }
});

/**
 * POST /uploads/torrent
 * Upload a torrent's files to Google Drive
 */
router.post('/torrent', async (req: Request, res: Response) => {
  try {
    const { torrentId, convertMp3ToM4b = false } = req.body;
    
    if (!torrentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Torrent ID is required' 
      });
    }

    // Use the unified upload function to ensure consistency across all upload pathways
    // Import the unified upload function dynamically to avoid circular dependencies
    const { uploadTorrentToGDrive } = await import('../../bot/uploadUtils');

    // Upload to Google Drive using the unified function (without progress target for API calls)
    const result = await uploadTorrentToGDrive(torrentId, convertMp3ToM4b);

    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        folderId: result.folderId,
        uploadedFiles: result.uploadedFiles,
        convertedFile: result.convertedFile
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Upload failed',
        uploadedFiles: result.uploadedFiles
      });
    }

  } catch (error) {
    console.error('Error uploading torrent:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to upload torrent' 
    });
  }
});

/**
 * GET /uploads/files
 * List files in Google Drive
 */
router.get('/files', async (req: Request, res: Response) => {
  try {
    const { parentId, maxResults = 10 } = req.query;
    
    const files = await uploadClient.listFiles(
      parentId as string, 
      parseInt(maxResults as string)
    );
    
    res.json({ 
      success: true, 
      files 
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to list Google Drive files' 
    });
  }
});

export default router;
