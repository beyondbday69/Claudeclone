import { Octokit } from '@octokit/rest';

export const getSystemPrompt = (owner?: string, repo?: string, branch?: string, mode: 'build' | 'plan' = 'build') => {
  const base = owner && repo 
    ? `You are a coding agent working against the GitHub repository ${owner}/${repo} on branch ${branch}.\nYou interact with this repository through a tool API.\nAlways read relevant files before editing to understand context.`
    : `You are an AI coding assistant. You have access to tools to help the user.`;
  
  if (mode === 'plan') {
    return `${base}\nYou are in PLAN MODE. You should analyze the user's request and create a detailed plan of what changes need to be made. Use tools to gather context, but DO NOT modify any files or execute actions.`;
  }
  
  if (owner && repo) {
    return `${base}\nMake minimal, focused changes.\nNever push to the default branch directly if it's protected — create a feature branch and open a PR.\nExplain what you're about to do before any write/commit/PR tool call, since the user must approve it.`;
  }
  return base;
};

export const getTools = (mode: 'build' | 'plan' = 'build', hasRepo: boolean = true, webSearchEnabled: boolean = false) => {
  const repoTools = hasRepo ? [
    {
      type: "function",
      function: {
        name: "list_files",
        description: "List files and directories in a given path",
        parameters: {
          type: "object",
          properties: { 
            path: { type: "string", description: "The path to list. Omit or use empty string for root." } 
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read contents of a file",
        parameters: {
          type: "object",
          properties: { 
            path: { type: "string", description: "The path to the file to read. Do not use leading slashes." } 
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description: "Write content to a file, this will create a commit",
        parameters: {
          type: "object",
          properties: { 
            path: { type: "string", description: "Path to the file. Do not use leading slashes." }, 
            content: { type: "string", description: "Complete new content for the file" },
            message: { type: "string", description: "Commit message" }
          },
          required: ["path", "content", "message"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_branch",
        description: "Create a new branch from the current default branch",
        parameters: {
          type: "object",
          properties: { 
            branch_name: { type: "string" } 
          },
          required: ["branch_name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "open_pr",
        description: "Open a pull request from a feature branch to the default branch",
        parameters: {
          type: "object",
          properties: { 
            title: { type: "string" },
            head: { type: "string", description: "The name of the branch where your changes are implemented." },
            base: { type: "string", description: "The name of the branch you want the changes pulled into." },
            body: { type: "string", description: "The contents of the pull request." }
          },
          required: ["title", "head", "base"]
        }
      }
    }
  ] : [];

  const generalTools = webSearchEnabled ? [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Search the web for information",
        parameters: {
          type: "object",
          properties: { 
            query: { type: "string", description: "The search query" } 
          },
          required: ["query"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "schedule",
        description: "Set a timer to wait before continuing execution. Use this to wait for tasks.",
        parameters: {
          type: "object",
          properties: {
            DurationSeconds: { type: "integer", description: "The number of seconds to wait" },
            Prompt: { type: "string", description: "The prompt to trigger after waiting" }
          },
          required: ["DurationSeconds", "Prompt"]
        }
      }
    }
  ] : [
    {
      type: "function",
      function: {
        name: "schedule",
        description: "Set a timer to wait before continuing execution. Use this to wait for tasks.",
        parameters: {
          type: "object",
          properties: {
            DurationSeconds: { type: "integer", description: "The number of seconds to wait" },
            Prompt: { type: "string", description: "The prompt to trigger after waiting" }
          },
          required: ["DurationSeconds", "Prompt"]
        }
      }
    }
  ];

  const tools = [...repoTools, ...generalTools];

  if (mode === 'plan') {
    return tools.filter(t => t.function.name === 'list_files' || t.function.name === 'read_file' || t.function.name === 'web_search' || t.function.name === 'schedule');
  }
  
  return tools;
};

export async function executeTool(toolCall: any, octokit: Octokit, owner: string, repo: string, currentBranch: string) {
  const { name, arguments: argsString } = toolCall.function;
  let args: any = {};
  
  try {
    args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
  } catch(e) {
    return { error: "Failed to parse arguments" };
  }

  const cleanPath = (p: string) => {
    if (!p || p === "''" || p === '""' || p === '.') return '';
    return p.replace(/^\/+/, '');
  };

  try {
    if (name === 'list_files') {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: cleanPath(args.path),
        ref: currentBranch
      });
      if (Array.isArray(data)) {
        return data.map((d: any) => ({ name: d.name, type: d.type, path: d.path }));
      }
      return { error: "Path is not a directory" };
    }
    
    if (name === 'read_file') {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: cleanPath(args.path),
        ref: currentBranch
      });
      if ('content' in data && data.type === 'file') {
        return { content: atob(data.content) };
      }
      return { error: "Path is not a file" };
    }
    
    if (name === 'write_file') {
      let sha: string | undefined = undefined;
      try {
        const { data: existing } = await octokit.repos.getContent({
          owner, repo, path: cleanPath(args.path), ref: currentBranch
        });
        if ('sha' in existing) {
          sha = existing.sha;
        }
      } catch(e) { /* File doesn't exist, which is fine for creation */ }
      
      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: cleanPath(args.path),
        message: args.message,
        content: btoa(unescape(encodeURIComponent(args.content))), // Safe base64 encode
        branch: currentBranch,
        sha
      });
      return { success: true, commit: data.commit.sha };
    }

    if (name === 'create_branch') {
      const { data: refData } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${currentBranch}` // Get base branch SHA
      });
      
      const { data } = await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${args.branch_name}`,
        sha: refData.object.sha
      });
      return { success: true, ref: data.ref };
    }

    if (name === 'open_pr') {
      const { data } = await octokit.pulls.create({
        owner,
        repo,
        title: args.title,
        head: args.head,
        base: args.base,
        body: args.body || ''
      });
      return { success: true, pr_url: data.html_url, pr_number: data.number };
    }

    if (name === 'web_search') {
      const response = await fetch(`/api/search?q=${encodeURIComponent(args.query)}`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    }

    if (name === 'schedule') {
      const durationSeconds = args.DurationSeconds || 0;
      await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000));
      return { success: true, message: `Waited for ${durationSeconds} seconds. Note: ${args.Prompt}` };
    }

    return { error: "Unknown tool" };
  } catch (error: any) {
    return { error: error.message || "Tool execution failed" };
  }
}

export const isRiskyTool = (name: string) => ['write_file', 'create_branch', 'commit', 'open_pr'].includes(name);
