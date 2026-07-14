import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const nvidiaTimestamps: number[] = [];
const NVIDIA_RPM = 40;
const NVIDIA_WINDOW = 60000;

async function throttleNvidia(): Promise<void> {
  const now = Date.now();
  const recent = nvidiaTimestamps.filter(t => now - t < NVIDIA_WINDOW);
  nvidiaTimestamps.length = 0;
  nvidiaTimestamps.push(...recent);
  
  if (nvidiaTimestamps.length >= NVIDIA_RPM) {
    const oldest = nvidiaTimestamps[0];
    const waitTime = NVIDIA_WINDOW - (now - oldest);
    console.log(`[RateLimiter] NVIDIA API limit reached. Sleeping for ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return throttleNvidia();
  }
  
  nvidiaTimestamps.push(Date.now());
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Proxy for OpenCode API
  app.get('/api/models', async (req, res) => {
    try {
      const provider = req.query.provider || 'opencode';
      let url = "https://opencode.ai/zen/v1/models";
      let auth = "Bearer sk-lnuJ2jLlii0Z00TEKuQBugkcw25XJGU3Y8USdUXZzFKWuB8ppTE3Fzme9AzKbKdN";
      
      if (provider === 'nvidia') {
        url = "https://integrate.api.nvidia.com/v1/models";
        auth = `Bearer ${process.env.NVIDIA_API_KEY}`;
        await throttleNvidia();
      }

      const response = await fetch(url, {
        headers: { Authorization: auth },
      });
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/env', (req, res) => {
    res.json({
      hasNvidiaKey: !!process.env.NVIDIA_API_KEY,
      githubToken: process.env.GITHUB_TOKEN || ''
    });
  });

  app.get('/api/search', async (req, res) => {
    try {
      const query = req.query.q;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing query parameter q' });
      }
      
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      const html = await response.text();
      
      const results = [];
      const snippetRegex = /<a class="result__snippet[^>]*>(.*?)<\/a>/g;
      const urlRegex = /<a class="result__url" href="([^"]+)">/g;
      const titleRegex = /<h2 class="result__title">.*?<a[^>]*>(.*?)<\/a>/gs;
      
      const snippets = [...html.matchAll(snippetRegex)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      const urls = [...html.matchAll(urlRegex)].map(m => {
          const u = m[1];
          const uddgMatch = u.match(/uddg=([^&]+)/);
          return uddgMatch ? decodeURIComponent(uddgMatch[1]) : u;
      });
      const titles = [...html.matchAll(titleRegex)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
      
      for (let i = 0; i < Math.min(5, urls.length); i++) {
        results.push({
          title: titles[i] || '',
          url: urls[i] || '',
          snippet: snippets[i] || ''
        });
      }
      
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Basic proxy for chat completions
  app.post('/api/agent/run', async (req, res) => {
    try {
      const { model, messages, tools, stream, provider } = req.body;
      
      const requestBody: any = {
        model: model || "deepseek-ai/deepseek-v4-flash",
        messages,
        max_tokens: 4096,
        stream: !!stream,
      };

      if (tools && tools.length > 0) {
        requestBody.tools = tools;
      }

      let url = "https://opencode.ai/zen/v1/chat/completions";
      let auth = "Bearer sk-lnuJ2jLlii0Z00TEKuQBugkcw25XJGU3Y8USdUXZzFKWuB8ppTE3Fzme9AzKbKdN";
      
      if (provider === 'nvidia') {
        url = "https://integrate.api.nvidia.com/v1/chat/completions";
        auth = `Bearer ${process.env.NVIDIA_API_KEY}`;
        await throttleNvidia();
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const data = await response.json();
        return res.status(response.status).json(data);
      }
      
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(decoder.decode(value));
          }
          res.end();
        } else {
          res.end();
        }
      } else {
        const data = await response.json();
        res.json(data.choices[0].message);
      }
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  const port = 3001;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on port ${port}`);
  });
}

createServer();
