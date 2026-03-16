import express from 'express';
import cors from 'cors';
import { env } from '../config/env';

// Import Discord bot (will start automatically if configured)
import '../discord/index';

// Create Express app
const app = express();
const PORT = env.HTTP_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (_, res) => {
  res.json({ 
    message: 'Welcome to the Discord BookBot API',
    status: 'OK'
  });
});

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/mam', require('./routes/mam').default);
app.use('/api/downloads', require('./routes/downloads').default);
app.use('/api/uploads', require('./routes/uploads').default);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { app, server };
