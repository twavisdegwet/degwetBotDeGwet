import express from 'express';

const router = express.Router();

// GET /health
  router.get('/', (_, res) => {
    res.json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'api-health'
    });
  });

export default router;
