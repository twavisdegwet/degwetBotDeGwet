import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../../config/env';

const router = express.Router();

// Helper function to check if a file is an audio book or ebook
const isAudioBookOrEbook = (filename: string): boolean => {
  const audioExtensions = ['.mp3', '.m4a', '.flac', '.wav', '.ogg'];
  const ebookExtensions = ['.epub', '.mobi', '.azw', '.pdf', '.txt'];
  
  const lowerFilename = filename.toLowerCase();
  
  // Check if it's an audio file
  for (const ext of audioExtensions) {
    if (lowerFilename.endsWith(ext)) {
      return true;
    }
  }
  
  // Check if it's an ebook file
  for (const ext of ebookExtensions) {
    if (lowerFilename.endsWith(ext)) {
      return true;
    }
  }
  
  return false;
};

// Helper function to get file information
const getFileDetails = async (filePath: string): Promise<any> => {
  try {
    const stats = await fs.stat(filePath);
    
    // Extract just the filename without path
    const basename = path.basename(filePath);
    
    return {
      name: basename,
      path: filePath,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime
    };
  } catch (error) {
    console.error(`Error getting file details for ${filePath}:`, error);
    return null;
  }
};

// Get all files in the downloads directory
router.get('/list', async (_req: Request, res: Response) => {
  try {
    const downloadDirectory = env.DOWNLOADS_DIRECTORY;
    
    // Check if the directory exists
    try {
      await fs.access(downloadDirectory);
    } catch (error) {
      return res.status(500).json({ 
        error: 'Download directory does not exist',
        directory: downloadDirectory 
      });
    }
    
    // Read all files in the directory
    const files = await fs.readdir(downloadDirectory);
    
    // Filter for audio books and ebooks only
    const filteredFiles = files.filter(file => 
      isAudioBookOrEbook(file)
    );
    
    // Get detailed information for each file
    const fileDetailsPromises = filteredFiles.map(async (file) => {
      const fullPath = path.join(downloadDirectory, file);
      return await getFileDetails(fullPath);
    });
    
    const fileDetails = await Promise.all(fileDetailsPromises);
    
    // Filter out any null results (errors)
    const validFileDetails = fileDetails.filter(detail => detail !== null);
    
    // Sort by modification date (newest first)
    validFileDetails.sort((a, b) => 
      new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    );
    
    return res.json({
      directory: downloadDirectory,
      count: validFileDetails.length,
      files: validFileDetails
    });
  } catch (error) {
    console.error('Error listing downloads:', error);
    return res.status(500).json({ 
      error: 'Failed to list downloads',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get specific file information
router.get('/file/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const downloadDirectory = env.DOWNLOADS_DIRECTORY;
    const fullPath = path.join(downloadDirectory, filename);
    
    // Check if the file is an audio book or ebook
    if (!isAudioBookOrEbook(filename)) {
      return res.status(400).json({ 
        error: 'File is not an audio book or ebook',
        filename 
      });
    }
    
    // Get file details
    const fileDetails = await getFileDetails(fullPath);
    
    return res.json({
      success: true,
      file: fileDetails
    });
  } catch (error) {
    console.error('Error getting file info:', error);
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return res.status(404).json({ 
        error: 'File not found',
        filename: req.params.filename 
      });
    }
    return res.status(500).json({ 
      error: 'Failed to get file information',
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;
