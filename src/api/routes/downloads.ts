// This file has been removed as part of the upload consolidation.
// The /listdownloads functionality has been removed per user request.
// All upload logic is now consolidated in the uploadUtils.ts system.

import express from 'express';
const router = express.Router();

// Removed /listdownloads functionality - use /gdrive-upload, /getebook, or /getaudiobook instead
router.get('/list', async (_req, res) => {
  res.status(410).json({ 
    error: 'This endpoint has been removed. Use /gdrive-upload, /getebook, or /getaudiobook commands instead.',
    message: 'The listdownloads functionality has been consolidated into the unified upload system.'
  });
});

router.get('/file/:filename', async (_req, res) => {
  res.status(410).json({ 
    error: 'This endpoint has been removed. Use /gdrive-upload, /getebook, or /getaudiobook commands instead.',
    message: 'The listdownloads functionality has been consolidated into the unified upload system.'
  });
});

export default router;
