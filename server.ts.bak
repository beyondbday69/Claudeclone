import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

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
      } else if (provider === 'openrouter') {
        url = "https://openrouter.ai/api/v1/models";
        auth = `Bearer ${process.env.OPENROUTER_API_KEY}`;
      } else if (provider === 'mistral') {
        url = "https://api.mistral.ai/v1/models";
        auth = `Bearer ${process.env.MISTRAL_API_KEY}`;
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

  // ─── Background Job System ───
  interface Job {
    id: string;
    status: 'running' | 'done' | 'error';
    chunks: string[];       // raw SSE lines accumulated
    error?: string;
    createdAt: number;
    listeners: Set<express.Response>;
  }

  const jobs = new Map<string, Job>();

  // Clean up old jobs every 10 minutes (keep for 30 min)
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.createdAt > 30 * 60 * 1000 && job.status !== 'running') {
        jobs.delete(id);
      }
    }
  }, 10 * 60 * 1000);

  // Start a background AI job
  app.post('/api/agent/start', async (req, res) => {
    try {
      const { model, messages, tools, provider } = req.body;
      
      const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      
      const job: Job = {
        id: jobId,
        status: 'running',
        chunks: [],
        createdAt: Date.now(),
        listeners: new Set(),
      };
      jobs.set(jobId, job);

      // Return jobId immediately
      res.json({ jobId });

      // Now run the AI call in the background
      (async () => {
        try {
          const { model, messages, tools, provider, reasoning_effort } = req.body;
          const requestBody: any = {
            model: model || "deepseek-ai/deepseek-v4-flash",
            messages,
            max_tokens: 4096,
            stream: true,
          };

          if (tools && tools.length > 0) {
            requestBody.tools = tools;
          }

          let url = "https://opencode.ai/zen/v1/chat/completions";
          let auth = "Bearer sk-lnuJ2jLlii0Z00TEKuQBugkcw25XJGU3Y8USdUXZzFKWuB8ppTE3Fzme9AzKbKdN";
          
          let extraHeaders: any = {};
          if (provider === 'nvidia') {
            url = "https://integrate.api.nvidia.com/v1/chat/completions";
            auth = `Bearer ${process.env.NVIDIA_API_KEY}`;
            await throttleNvidia();
          } else if (provider === 'openrouter') {
            url = "https://openrouter.ai/api/v1/chat/completions";
            auth = `Bearer ${process.env.OPENROUTER_API_KEY}`;
            extraHeaders['HTTP-Referer'] = "http://localhost:3000";
            extraHeaders['X-Title'] = "Claudeclone";
          } else if (provider === 'mistral') {
            url = "https://api.mistral.ai/v1/chat/completions";
            auth = `Bearer ${process.env.MISTRAL_API_KEY}`;
            if (model && model.startsWith('ag_')) {
              url = "https://api.mistral.ai/v1/agents/completions";
              requestBody.agent_id = requestBody.model;
              delete requestBody.model;
              delete requestBody.tools; // Mistral agents have built-in tools
            } else {
              if (reasoning_effort && reasoning_effort !== 'none') {
                requestBody.reasoning_effort = reasoning_effort;
              }
            }
          }

          // Helper to broadcast a chunk to all listeners
          const broadcast = (chunk: string) => {
            job.chunks.push(chunk);
            for (const listener of job.listeners) {
              try { listener.write(chunk); } catch {}
            }
          };

          // Retry loop for rate limits
          const MAX_RETRIES = 3;
          let attempt = 0;
          let response: Response | null = null;

          while (attempt < MAX_RETRIES) {
            attempt++;

            response = await fetch(url, {
              method: "POST",
              headers: {
                Authorization: auth,
                "Content-Type": "application/json",
                ...extraHeaders
              },
              body: JSON.stringify(requestBody),
            });

            if (response.ok) break;

            // Check for rate limit (429)
            if (response.status === 429 && provider === 'nvidia' && attempt < MAX_RETRIES) {
              const waitSecs = 60;
              console.log(`[RateLimiter] NVIDIA 429 hit. Waiting ${waitSecs}s before retry (attempt ${attempt}/${MAX_RETRIES})...`);
              
              // Send countdown events to the client
              broadcast(`data: ${JSON.stringify({ rateLimit: true, waitSeconds: waitSecs, attempt, maxRetries: MAX_RETRIES })}\n\n`);

              // Wait with 1-second countdown ticks
              for (let i = waitSecs; i > 0; i--) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                broadcast(`data: ${JSON.stringify({ rateLimit: true, countdown: i - 1 })}\n\n`);
              }

              // Reset nvidia timestamps since we waited
              nvidiaTimestamps.length = 0;
              continue;
            }

            // Non-429 error or out of retries
            let errMsg = response.statusText;
            try {
              const errData = await response.json();
              errMsg = errData.error?.message || errData.error || errData.message || JSON.stringify(errData);
            } catch { /* use statusText */ }
            job.status = 'error';
            job.error = errMsg;
            broadcast(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
            for (const listener of job.listeners) {
              try { listener.end(); } catch {}
            }
            job.listeners.clear();
            return;
          }

          if (!response || !response.ok) {
            job.status = 'error';
            job.error = 'Max retries exceeded';
            broadcast(`data: ${JSON.stringify({ error: 'Rate limit: max retries exceeded' })}\n\n`);
            for (const listener of job.listeners) {
              try { listener.end(); } catch {}
            }
            job.listeners.clear();
            return;
          }

          if (!response.body) {
            job.status = 'error';
            job.error = 'No response body';
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");

          let finalResponseText = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              broadcast(chunk);

              // Extract text from SSE chunk for email summary
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const delta = data.choices?.[0]?.delta;
                    if (delta) {
                      if (typeof delta.reasoning === 'string' && delta.reasoning) {
                        finalResponseText += `<think>${delta.reasoning}</think>\n\n`;
                      }
                      if (typeof delta.content === 'string') {
                        finalResponseText += delta.content;
                      } else if (Array.isArray(delta.content)) {
                        for (const item of delta.content) {
                          if (item.type === 'text' && item.text) finalResponseText += item.text;
                          if (item.type === 'reasoning' && item.reasoning) finalResponseText += `<think>${item.reasoning}</think>\n\n`;
                          if (item.type === 'thinking') {
                            const tc = typeof item.thinking === 'string' ? item.thinking : (Array.isArray(item.thinking) ? item.thinking.map((t: any) => t.text).join('') : '');
                            if (tc) finalResponseText += `<think>${tc}</think>\n\n`;
                          }
                        }
                      } else if (typeof delta.content === 'object' && delta.content !== null) {
                        const contentObj = delta.content as any;
                        if (contentObj.text) finalResponseText += contentObj.text;
                        if (contentObj.reasoning) finalResponseText += `<think>${contentObj.reasoning}</think>\n\n`;
                      }
                    }
                  } catch (e) {}
                }
              }
            }
          } catch (e: any) {
            job.error = e.message;
          }

          job.status = 'done';
          // Signal done to all listeners
          for (const listener of job.listeners) {
            try { listener.end(); } catch {}
          }
          job.listeners.clear();

          if (req.body.notifyEmail) {
            const emailText = finalResponseText 
              ? `Your task has finished successfully.\n\nAI Response Summary:\n${finalResponseText}`
              : 'Your long-running task has finished successfully.';
            sendTaskCompleteEmail(job.id, 'Task Completed', emailText);
          }

        } catch (error: any) {
          job.status = 'error';
          job.error = error.message;
          for (const listener of job.listeners) {
            try { listener.end(); } catch {}
          }
          job.listeners.clear();

          if (req.body.notifyEmail) {
            sendTaskCompleteEmail(job.id, 'Task Failed', `Your task failed with error: ${error.message}`);
          }
        }
      })();
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  async function sendTaskCompleteEmail(jobId: string, subject: string, text: string) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP credentials not set. Skipping email notification.");
      return;
    }
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.SMTP_USER, // Send to self
        subject: `[Claudeclone] ${subject} (Job: ${jobId})`,
        text: text + `\n\nJob ID: ${jobId}`,
      });
      console.log(`Notification email sent for job ${jobId}`);
    } catch (err) {
      console.error(`Failed to send email for job ${jobId}:`, err);
    }
  }

  // Stream/reconnect to a background job
  app.get('/api/agent/stream/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send all accumulated chunks first (replay)
    for (const chunk of job.chunks) {
      res.write(chunk);
    }

    // If job is already done, end immediately
    if (job.status !== 'running') {
      return res.end();
    }

    // Otherwise, register as a live listener
    job.listeners.add(res);
    req.on('close', () => {
      job.listeners.delete(res);
    });
  });

  // Check job status (lightweight)
  app.get('/api/agent/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ status: job.status, error: job.error });
  });

  // Keep old /api/agent/run as fallback
  app.post('/api/agent/run', async (req, res) => {
    try {
      const { model, messages, tools, stream, provider, reasoning_effort } = req.body;
      
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
      
      let extraHeaders: any = {};
      if (provider === 'nvidia') {
        url = "https://integrate.api.nvidia.com/v1/chat/completions";
        auth = `Bearer ${process.env.NVIDIA_API_KEY}`;
        await throttleNvidia();
      } else if (provider === 'openrouter') {
        url = "https://openrouter.ai/api/v1/chat/completions";
        auth = `Bearer ${process.env.OPENROUTER_API_KEY}`;
        extraHeaders['HTTP-Referer'] = "http://localhost:3000";
        extraHeaders['X-Title'] = "Claudeclone";
      } else if (provider === 'mistral') {
        url = "https://api.mistral.ai/v1/chat/completions";
        auth = `Bearer ${process.env.MISTRAL_API_KEY}`;
        if (model && model.startsWith('ag_')) {
          url = "https://api.mistral.ai/v1/agents/completions";
          requestBody.agent_id = requestBody.model;
          delete requestBody.model;
          delete requestBody.tools; // Mistral agents have built-in tools
        } else {
          if (reasoning_effort && reasoning_effort !== 'none') {
            requestBody.reasoning_effort = reasoning_effort;
          }
        }
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
          ...extraHeaders
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
