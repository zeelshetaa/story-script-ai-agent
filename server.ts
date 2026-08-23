import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { config } from './server/config.ts';
import { projectRouter } from './server/routes/projectRoutes.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = config.port;

  // Basic Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: Boolean(config.geminiApiKey),
      hasGroqKey: Boolean(config.groqApiKey),
      provider: config.groqApiKey ? 'groq' : 'gemini',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount Project API Routes
  app.use('/api', projectRouter);
  // Also mount directly on root to support user's prompt paths like /projects
  app.use('/', projectRouter);

  // Vite middleware for dev / static files for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Story to Video Script AI Engine running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
