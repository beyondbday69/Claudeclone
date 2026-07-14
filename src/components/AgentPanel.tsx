import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tokyoNight } from '../utils/tokyoNight';
import { Bot, Terminal, ArrowUp, Check, Loader2, Eye, Code, Link2, User, ArrowLeft, X, ChevronDown, ChevronUp, Copy, MoreVertical, Hand, Ban } from 'lucide-react';
import { Octokit } from '@octokit/rest';
import { getTools, executeTool, isRiskyTool, getSystemPrompt } from '../utils/githubTools';
import { connectMcp, getMcpTools, executeMcpTool } from '../utils/mcpClient';

interface AgentPanelProps {
  owner?: string;
  repo?: string;
  branch?: string;
  octokit?: Octokit;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolCalls?: any[];
  toolCallId?: string;
  isApprovalPending?: boolean;
}

export interface ChatSession {
  id: string;
  name: string;
  updatedAt: number;
  messages: Message[];
}

import { getConnectedMcpUrls, disconnectMcp } from '../utils/mcpClient';
export default function AgentPanel({ owner, repo, branch, octokit }: AgentPanelProps) {
  const [mcpReloadState, setMcpReloadState] = useState(0);
  useEffect(() => {
    mcpServers.forEach(url => {
        connectMcp(url).then(res => {
            if (res.success) {
                setMcpReloadState(prev => prev + 1);
            }
        }).catch(console.error);
    });
  }, []);

  const [model, setModel] = useState<string>(() => localStorage.getItem('selected_model') || 'deepseek-ai/deepseek-v4-flash');
  const [provider, setProvider] = useState<string>(() => localStorage.getItem('selected_provider') || 'opencode');
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/models?provider=${provider}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setModels(data.data);
          const savedModel = localStorage.getItem('selected_model');
          if (savedModel && data.data.some((m: any) => m.id === savedModel)) {
             setModel(savedModel);
          } else {
             const defaultModel = data.data.find((m: any) => m.id.includes('deepseek-v4-flash')) || data.data[0];
             if (defaultModel) {
                setModel(defaultModel.id);
             }
          }
        }
      })
      .catch(console.error);
  }, [provider]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: `Workspace ready.`
    }
  ]);
  const [sessionId, setSessionId] = useState<string>(() => Date.now().toString());
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('chat_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });
  const [showSessionsPanel, setShowSessionsPanel] = useState(false);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [currentBranch, setCurrentBranch] = useState(branch);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [files, setFiles] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [agentMode, setAgentMode] = useState<'build' | 'plan'>('build');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [showMcpDialog, setShowMcpDialog] = useState(false);
  const [mcpInputUrl, setMcpInputUrl] = useState('');
  const [mcpServers, setMcpServers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mcp_servers');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  useEffect(() => {
    localStorage.setItem('mcp_servers', JSON.stringify(mcpServers));
  }, [mcpServers]);
  const [toolPermissions, setToolPermissions] = useState<Record<string, 'allow' | 'ask' | 'block'>>(() => {
    try {
      const saved = localStorage.getItem('mcp_tool_permissions');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  useEffect(() => {
    if (messages.length > 1) {
      setSessions(prevSessions => {
        const existing = prevSessions.find(s => s.id === sessionId);
        const name = existing?.name || messages.find(m => m.role === 'user')?.content.slice(0, 40) || 'New Chat';
        const updatedSessions = prevSessions.filter(s => s.id !== sessionId);
        const newSession = {
          id: sessionId,
          name,
          updatedAt: Date.now(),
          messages
        };
        const newSessions = [newSession, ...updatedSessions].slice(0, 50); // keep last 50
        localStorage.setItem('chat_sessions', JSON.stringify(newSessions));
        return newSessions;
      });
    }
  }, [messages, sessionId]);

  const createNewSession = () => {
    setSessionId(Date.now().toString());
    setMessages([{ id: 'welcome', role: 'system', content: `Workspace ready.` }]);
    setShowSessionsPanel(false);
  };

  const loadSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setSessionId(session.id);
      setMessages(session.messages);
      setShowSessionsPanel(false);
    }
  };
  
  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    localStorage.setItem('chat_sessions', JSON.stringify(newSessions));
    if (id === sessionId) {
      createNewSession();
    }
  };

  useEffect(() => {
    localStorage.setItem('mcp_tool_permissions', JSON.stringify(toolPermissions));
  }, [toolPermissions]);

  const getToolPermission = (name: string): 'allow' | 'ask' | 'block' => {
    if (toolPermissions[name]) {
      return toolPermissions[name];
    }
    return isRiskyTool(name) ? 'ask' : 'allow';
  };

  const getActiveMcpTools = () => {
    return getMcpTools();
  };

    const getMcpName = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      if (url.hostname.includes('spoti')) return "Spotify";
      const hostPart = url.hostname.split('.')[0];
      return hostPart.charAt(0).toUpperCase() + hostPart.slice(1);
    } catch (e) { return "MCP Server"; }
  };

  const humanizeToolName = (name: string) => {
    if (!name) return "";
    const spaced = name.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };

  const [copied, setCopied] = useState(false);
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [mcpCollapsed, setMcpCollapsed] = useState(false);
  const [localCollapsed, setLocalCollapsed] = useState(true);
  const [activePresetMenu, setActivePresetMenu] = useState<'mcp' | 'local' | null>(null);

  const applyPreset = (group: 'mcp' | 'local', mode: 'allow' | 'ask' | 'block') => {
    const tools = group === 'mcp' ? getActiveMcpTools() : getTools(agentMode, !!(owner && repo), webSearchEnabled);
    const updated = { ...toolPermissions };
    tools.forEach((t: any) => {
      updated[t.function.name] = mode;
    });
    setToolPermissions(updated);
    setActivePresetMenu(null);
  };

  const getPresetLabel = (group: 'mcp' | 'local') => {
    const tools = group === 'mcp' ? getActiveMcpTools() : getTools(agentMode, !!(owner && repo), webSearchEnabled);
    if (tools.length === 0) return "Custom";
    
    const firstPerm = getToolPermission(tools[0].function.name);
    const allSame = tools.every((t: any) => getToolPermission(t.function.name) === firstPerm);
    
    if (allSame) {
      if (firstPerm === 'allow') return "Allow All";
      if (firstPerm === 'ask') return "Ask All";
      if (firstPerm === 'block') return "Block All";
    }
    return "Custom";
  };

  useEffect(() => {
    async function fetchFiles() {
      if (!octokit || !owner || !repo || !branch) return;
      try {
        const { data } = await octokit.git.getTree({
          owner,
          repo,
          tree_sha: branch,
          recursive: '1'
        });
        const filePaths = data.tree.filter((t: any) => t.type === 'blob').map((t: any) => t.path || '');
        setFiles(filePaths);
      } catch (err) {
        console.error("Failed to fetch tree for mentions", err);
      }
    }
    fetchFiles();
  }, [owner, repo, branch, octokit]);

  useEffect(() => {
    setCurrentBranch(branch || 'main');
  }, [branch]);

  const handleConnectMcp = async () => {
    if (!mcpInputUrl.trim()) return;
    const result = await connectMcp(mcpInputUrl.trim());
    if (result.success) {
       if (!mcpServers.includes(mcpInputUrl.trim())) {
           setMcpServers([...mcpServers, mcpInputUrl.trim()]);
       }
       setMcpInputUrl('');
       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Connected to MCP server. ${result.tools?.length || 0} tools loaded.` }]);
    } else {
       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Failed to connect to MCP server. Error: ${result.error}` }]);
    }
  };

  const handleDisconnectMcp = (url: string) => {
    // Ideally call disconnectMcp(url)
    setMcpServers(mcpServers.filter(u => u !== url));
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Disconnected from MCP server ${url}.` }]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const callAgentAPI = async (currentMsgs: Message[]) => {
    setRunning(true);
    
    // Format for NVIDIA API
    const apiMessages = [
      { role: 'system', content: getSystemPrompt(owner, repo, currentBranch, agentMode) },
      ...currentMsgs.filter(m => m.role !== 'system').map(m => {
        const payload: any = {
          role: m.role,
          content: m.content || "",
        };
        
        if (m.toolCalls && m.toolCalls.length > 0) {
          payload.tool_calls = m.toolCalls.map((tc: any) => ({
            id: tc.id,
            type: tc.type || 'function',
            function: {
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || ''
            }
          }));
        }
        
        if (m.toolCallId) {
          payload.tool_call_id = m.toolCallId;
        }
        
        return payload;
      })
    ];

    try {
      const response = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: "", // Task is already in messages
          model,
          provider,
          messages: apiMessages,
          tools: [...getTools(agentMode, !!(owner && repo), webSearchEnabled), ...getActiveMcpTools()],
          stream: true
        })
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      
      const newMsgId = Date.now().toString() + Math.random().toString();
      const newMsg: Message = {
        id: newMsgId,
        role: 'assistant',
        content: '',
      };
      
      setMessages(prev => [...prev, newMsg]);
      
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let fullContent = '';
      let toolCalls: any = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === 'data: [DONE]') continue;
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices[0]?.delta;
              
              if (delta) {
                if (delta.content) {
                  fullContent += delta.content;
                  setMessages(prev => prev.map(m => m.id === newMsgId ? { ...m, content: fullContent } : m));
                }
                
                if (delta.tool_calls) {
                  if (!toolCalls) toolCalls = [];
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    if (!toolCalls[idx]) {
                      toolCalls[idx] = { ...tc };
                      if (!toolCalls[idx].function) toolCalls[idx].function = { name: '', arguments: '' };
                      if (!toolCalls[idx].function.arguments) toolCalls[idx].function.arguments = '';
                    } else {
                      if (tc.function?.arguments) {
                        toolCalls[idx].function.arguments += tc.function.arguments;
                      }
                      if (tc.id) toolCalls[idx].id = tc.id;
                      if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore parse errors from partial JSON
            }
          }
        }
      }
      
      let hasAsk = false;
      let finalToolCalls: any[] | undefined = undefined;
      
      if (toolCalls && toolCalls.length > 0) {
        finalToolCalls = toolCalls.filter(Boolean);
        hasAsk = finalToolCalls.some((tc: any) => getToolPermission(tc.function.name) === 'ask');
      }

      let computedNextMsgs: Message[] = [];
      setMessages(prev => {
        computedNextMsgs = prev.map(m => {
          if (m.id === newMsgId) {
            return {
              ...m,
              content: fullContent,
              ...(finalToolCalls ? { toolCalls: finalToolCalls } : {}),
              ...(hasAsk ? { isApprovalPending: true } : {})
            };
          }
          return m;
        });
        return computedNextMsgs;
      });
      
      // Compute synchronously just in case React batches
      const syncNextMsgs = [...currentMsgs, {
        id: newMsgId,
        role: 'assistant' as const,
        content: fullContent,
        ...(finalToolCalls ? { toolCalls: finalToolCalls } : {}),
        ...(hasAsk ? { isApprovalPending: true } : {})
      }];

      const updatedMsg = syncNextMsgs.find(m => m.id === newMsgId);
      
      if (updatedMsg?.toolCalls && !updatedMsg.isApprovalPending) {
         setTimeout(() => executePendingTools(updatedMsg, syncNextMsgs), 0);
      } else if (!updatedMsg?.toolCalls) {
         setRunning(false);
      }

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + Math.random().toString(),
        role: 'system',
        content: `Error: ${err.message}`
      }]);
      setRunning(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || running) return;

    const task = input.trim();
    setInput('');
    setShowMentions(false);
    
    const newMsgs = [...messages, { id: Date.now().toString() + Math.random().toString(), role: 'user' as const, content: task }];
    setMessages(newMsgs);
    callAgentAPI(newMsgs);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPosition);
    
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^\s]*)$/);
    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const filteredFiles = files.filter(f => f.toLowerCase().includes(mentionFilter.toLowerCase())).slice(0, 10);

  const insertMention = (filename: string) => {
    const textarea = document.querySelector('textarea');
    if (!textarea) return;
    
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = input.slice(0, cursorPosition);
    const textAfterCursor = input.slice(cursorPosition);
    
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([^\s]*)$/);
    if (mentionMatch) {
      const matchIndex = mentionMatch.index || 0;
      const whitespace = mentionMatch[0].startsWith(' ') || mentionMatch[0].startsWith('\n') ? mentionMatch[0][0] : '';
      
      const newText = textBeforeCursor.slice(0, matchIndex) + whitespace + '@' + filename + ' ' + textAfterCursor;
      setInput(newText);
      setShowMentions(false);
      
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = matchIndex + whitespace.length + filename.length + 2;
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredFiles.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredFiles.length) % filteredFiles.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredFiles[mentionIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const executePendingTools = async (assistantMsg: Message, currentMsgs: Message[]) => {
    if (!assistantMsg.toolCalls) return;
    
    setRunning(true);
    
    // Immediately mark as no longer pending in state to avoid race conditions
    setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, isApprovalPending: false } : m));

    const toolResults: Message[] = [];
    for (const toolCall of assistantMsg.toolCalls) {
       let result;
       const toolName = toolCall.function.name;
       const permission = getToolPermission(toolName);

       if (permission === 'block') {
          result = { error: `Execution of tool '${toolName}' is blocked by user permissions.` };
       } else if (getTools(agentMode, !!(owner && repo), webSearchEnabled).some(t => t.function.name === toolName)) {
          result = await executeTool(toolCall, octokit!, owner!, repo!, currentBranch!);
          
          if (toolCall.function.name === 'create_branch' && (result as any).success) {
             try {
                const args = JSON.parse(toolCall.function.arguments);
                setCurrentBranch(args.branch_name);
             } catch(e){}
          }
       } else {
          try {
             const mcpArgs = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
             result = await executeMcpTool(toolName, mcpArgs);
          } catch(e: any) {
             result = { error: e.message };
          }
       }

       const toolMsg: Message = {
          id: Date.now().toString() + Math.random().toString(),
          role: 'tool',
          toolCallId: toolCall.id,
          content: JSON.stringify(result)
       };
       toolResults.push(toolMsg);
    }
    
    let finalMsgs: Message[] = [];
    const toolCallIds = toolResults.map(tr => tr.toolCallId);
    setMessages(prev => {
      const cleaned = prev.map(m => m.id === assistantMsg.id ? { ...m, isApprovalPending: false } : m);
      const filtered = cleaned.filter(m => !(m.role === 'tool' && toolCallIds.includes(m.toolCallId)));
      return [...filtered, ...toolResults];
    });

    const cleanedMsgs = currentMsgs.map(m => m.id === assistantMsg.id ? { ...m, isApprovalPending: false } : m);
    const filteredMsgs = cleanedMsgs.filter(m => !(m.role === 'tool' && toolCallIds.includes(m.toolCallId)));
    finalMsgs = [...filteredMsgs, ...toolResults];

    setTimeout(() => {
      callAgentAPI(finalMsgs);
    }, 50);
  };

  const handleDeny = (assistantMsg: Message, currentMsgs: Message[]) => {
    if (!assistantMsg.toolCalls) return;
    
    const toolResults: Message[] = [];
    for (const toolCall of assistantMsg.toolCalls) {
       toolResults.push({
          id: Date.now().toString() + Math.random().toString(),
          role: 'tool',
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: "User denied the operation" })
       });
    }
    
    const toolCallIds = toolResults.map(tr => tr.toolCallId);
    setMessages(prev => {
      const cleaned = prev.map(m => m.id === assistantMsg.id ? { ...m, isApprovalPending: false } : m);
      const filtered = cleaned.filter(m => !(m.role === 'tool' && toolCallIds.includes(m.toolCallId)));
      return [...filtered, ...toolResults];
    });

    const cleanedMsgs = currentMsgs.map(m => m.id === assistantMsg.id ? { ...m, isApprovalPending: false } : m);
    const filteredMsgs = cleanedMsgs.filter(m => !(m.role === 'tool' && toolCallIds.includes(m.toolCallId)));
    const finalMsgs = [...filteredMsgs, ...toolResults];

    setTimeout(() => {
      callAgentAPI(finalMsgs);
    }, 50);
  };


const getToolIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('search') || n.includes('find')) return 'ph-magnifying-glass';
  if (n.includes('edit') || n.includes('replace') || n.includes('modify') || n.includes('update')) return 'ph-pencil';
  if (n.includes('read') || n.includes('view') || n.includes('list') || n.includes('get')) return 'ph-book-open';
  if (n.includes('create') || n.includes('write') || n.includes('add') || n.includes('new')) return 'ph-plus-circle';
  if (n.includes('delete') || n.includes('remove') || n.includes('drop')) return 'ph-trash';
  if (n.includes('push') || n.includes('commit') || n.includes('git') || n.includes('branch')) return 'ph-git-branch';
  if (n.includes('run') || n.includes('execute') || n.includes('command') || n.includes('bash')) return 'ph-terminal-window';
  if (n.includes('browser') || n.includes('url') || n.includes('web')) return 'ph-globe';
  if (n.includes('agent') || n.includes('prompt') || n.includes('chat') || n.includes('ask')) return 'ph-robot';
  return 'ph-wrench';
};

const ToolCallView = ({ tc, msg, toolResultMsg, executePendingTools, handleDeny, messages, isLast }: any) => {
  const [expanded, setExpanded] = useState(false);
  const [allowDropdownOpen, setAllowDropdownOpen] = useState(false);
  
  let parsedArgs = tc.function.arguments;
  try {
    if (typeof parsedArgs === 'string') {
      parsedArgs = JSON.stringify(JSON.parse(parsedArgs), null, 2);
    }
  } catch(e) {}

  let resultStr = toolResultMsg ? toolResultMsg.content : "";
  try {
    if (resultStr) {
       const parsedRes = JSON.parse(resultStr);
       if (parsedRes.error) {
          resultStr = parsedRes.error;
       } else if (parsedRes.message) {
          resultStr = parsedRes.message;
       } else if (parsedRes.content) {
          if (typeof parsedRes.content === 'string') {
             resultStr = parsedRes.content;
          } else if (Array.isArray(parsedRes.content)) {
             resultStr = parsedRes.content.map((c: any) => c.text || JSON.stringify(c)).join('\n');
          } else {
             resultStr = JSON.stringify(parsedRes.content, null, 2);
          }
       } else if (parsedRes.success !== undefined && Object.keys(parsedRes).length === 1) {
          resultStr = "Success";
       } else {
          resultStr = JSON.stringify(parsedRes, null, 2);
       }
    }
  } catch(e) {}

  const isRunning = !toolResultMsg && !msg.isApprovalPending;

  return (
    <div className="relative py-1 group">
      <div className="flex flex-col gap-2">
        <button 
          className="w-full flex items-center justify-between text-xs font-mono text-app-textSecondary hover:text-app-textPrimary transition-premium rounded py-1" 
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <i className={`ph-light ${getToolIcon(tc.function.name)} text-sm text-app-textMuted`}></i>
            <span className="capitalize font-semibold">{tc.function.name.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-app-textMuted font-sans">
            {isRiskyTool(tc.function.name) && msg.isApprovalPending && (
               <span className="text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded font-bold">APPROVAL NEEDED</span>
            )}
            {isRunning && (
               <span className="text-app-textSecondary flex items-center gap-1 font-bold">
                  <Loader2 className="w-3 h-3 animate-spin" /> RUNNING
               </span>
            )}
            <i className={`ph-light ${expanded ? 'ph-caret-up' : 'ph-caret-down'} text-[10px]`}></i>
          </div>
        </button>
        
        <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ opacity: 0, filter: 'blur(4px)', height: 0 }}
            animate={{ opacity: 1, filter: 'blur(0px)', height: 'auto' }}
            exit={{ opacity: 0, filter: 'blur(4px)', height: 0 }}
            transition={{ duration: 0.2 }}
            className="text-xs font-mono bg-app-codeBg text-app-textSecondary rounded border border-app-border/30 overflow-hidden mb-2"
          >
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-3">
                <div className="text-[9px] text-app-textMuted uppercase tracking-wider font-sans mb-1 font-bold">Request</div>
                <SyntaxHighlighter
                  style={tokyoNight as any}
                  language="json"
                  PreTag="div"
                  customStyle={{ margin: 0, padding: 0, background: 'transparent', fontSize: '11px' }}
                  className="custom-scrollbar overflow-x-auto text-app-textSecondary"
                >
                  {parsedArgs}
                </SyntaxHighlighter>
              </div>
              {toolResultMsg && (
                <div className="p-3 border-t md:border-t-0 md:border-l border-app-border/30 bg-[var(--color-app-surface)] overflow-hidden">
                  <div className="text-[9px] text-app-textMuted uppercase tracking-wider font-sans mb-1 font-bold">Result</div>
                  <SyntaxHighlighter
                    style={tokyoNight as any}
                    language="json"
                    PreTag="div"
                    customStyle={{ margin: 0, padding: 0, background: 'transparent', fontSize: '11px', maxHeight: '10rem', overflowY: 'auto' }}
                    className="custom-scrollbar overflow-x-auto text-app-textMuted"
                  >
                    {resultStr}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
        
        <AnimatePresence>
        {msg.isApprovalPending && (
          <motion.div 
            initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.95 }}
            animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)', scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mt-3 mb-2 bg-[var(--color-app-surface)] border border-[var(--color-app-borderLight)] rounded-xl p-5 flex flex-col items-center text-center shadow-xl w-full max-w-[320px] mx-auto z-20 relative"
          >
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-app-surface)] border border-[var(--color-app-borderLight)] flex items-center justify-center shadow-inner mb-4">
               <span className="text-xl font-semibold text-white">
                 {tc.function.name.charAt(0).toUpperCase()}
               </span>
            </div>
            
            <p className="text-[15px] font-medium text-white mb-6">
              Agent wants to use <span className="font-semibold">{tc.function.name.replace(/_/g, ' ')}</span>
            </p>

            <div className="w-full flex flex-col gap-2.5">
               <div className="flex w-full relative">
                 <button 
                    className="flex-1 bg-white hover:bg-gray-200 text-black font-semibold py-2.5 px-4 rounded-l-lg text-sm transition-colors flex items-center justify-center gap-2"
                    onClick={() => {
                        setAllowDropdownOpen(false);
                        executePendingTools(msg, messages);
                    }}
                 >
                    Always allow <span className="text-black/50 font-normal text-xs ml-1">Enter</span>
                 </button>
                 <div className="w-px bg-black/10 z-10 absolute right-[40px] top-0 bottom-0"></div>
                 <button 
                    className="bg-white hover:bg-gray-200 text-black px-3 rounded-r-lg transition-colors flex items-center justify-center w-[40px]"
                    onClick={() => setAllowDropdownOpen(!allowDropdownOpen)}
                 >
                    <i className="ph-light ph-caret-down"></i>
                 </button>
                 
                 <AnimatePresence>
                 {allowDropdownOpen && (
                    <motion.div 
                      initial={{ opacity: 0, filter: 'blur(4px)', y: -5 }}
                      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                      exit={{ opacity: 0, filter: 'blur(4px)', y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-app-surfaceHover)] border border-[var(--color-app-borderLight)] rounded-lg shadow-xl overflow-hidden z-30"
                    >
                       <button 
                         className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-[var(--color-app-surfaceHover)] transition-colors flex items-center justify-between"
                         onClick={() => {
                            setAllowDropdownOpen(false);
                            executePendingTools(msg, messages);
                         }}
                       >
                         Allow once <span className="text-white/40 text-xs">Ctrl Enter</span>
                       </button>
                    </motion.div>
                 )}
                 </AnimatePresence>
               </div>
               
               <button 
                  className="w-full bg-[var(--color-app-surfaceHover)] hover:bg-[var(--color-app-surfaceHover)] text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 border border-transparent"
                  onClick={() => handleDeny(msg, messages)}
               >
                  Deny <span className="text-white/40 font-normal text-xs ml-1">Esc</span>
               </button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
};

return (
    <main className="flex-1 flex flex-col h-full relative w-full bg-app-main text-app-textPrimary font-sans antialiased overflow-hidden selection:bg-app-surfaceHover selection:text-white">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-app-border/10 shrink-0">
        <div className="flex items-center gap-1 text-xs text-app-textSecondary">
          <span 
            className="hover:text-app-textPrimary cursor-pointer flex items-center gap-1.5 transition-premium" 
            onClick={() => setShowSessionsPanel(true)}
          >
            <i className="ph-light ph-clock-counter-clockwise text-sm"></i>
            History
          </span>
          
          <i className="ph-light ph-caret-right text-xxs text-app-textMuted mx-1"></i>

          <span 
            className="hover:text-app-textPrimary cursor-pointer flex items-center gap-1.5 transition-premium" 
            onClick={() => setShowMcpDialog(true)}
          >
            <div className="w-3.5 h-3.5 rounded-[3px] bg-[var(--color-app-surface)] flex items-center justify-center text-[8px] font-bold text-app-textPrimary">
              {mcpServers.length > 0 ? getConnectedMcpUrls().length : 'M'}
            </div>
            {mcpServers.length > 0 ? `${getConnectedMcpUrls().length} MCP(s)` : 'Connect'}
          </span>
          <i className="ph-light ph-caret-right text-xxs text-app-textMuted"></i>
          
          <span className="text-app-textPrimary flex items-center gap-2 transition-premium bg-app-surface/40 hover:bg-app-surface/80 border border-app-border/30 px-2 py-0.5 rounded relative">
            {(providerDropdownOpen || modelDropdownOpen) && (
              <div className="fixed inset-0 z-40" onClick={() => { setProviderDropdownOpen(false); setModelDropdownOpen(false); }} />
            )}
            
            <div className="relative flex items-center z-50">
              <div 
                className="bg-transparent font-medium outline-none cursor-pointer text-app-textSecondary pr-4 flex items-center gap-1 select-none"
                onClick={() => { setProviderDropdownOpen(!providerDropdownOpen); setModelDropdownOpen(false); }}
              >
                {provider === 'opencode' ? 'OpenCode' : 'NVIDIA'}
                <i className="ph-light ph-caret-down text-xxs text-app-textMuted absolute right-0"></i>
              </div>
              
              <AnimatePresence>
                {providerDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-0 mt-1.5 w-32 bg-[var(--color-app-surface)] border border-app-border/30 rounded shadow-lg overflow-hidden flex flex-col py-1"
                  >
                    {[
                      { id: 'opencode', name: 'OpenCode' },
                      { id: 'nvidia', name: 'NVIDIA' }
                    ].map(p => (
                      <div 
                        key={p.id}
                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-app-surface/60 transition-premium shrink-0 leading-normal ${provider === p.id ? 'text-app-textPrimary bg-app-surface/30' : 'text-app-textSecondary'}`}
                        onClick={() => {
                          setProvider(p.id);
                          localStorage.setItem('selected_provider', p.id);
                          setProviderDropdownOpen(false);
                        }}
                      >
                        {p.name}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <i className="ph-light ph-caret-right text-xxs text-app-textMuted z-50"></i>
            
            <div className="relative flex items-center z-50">
              <div 
                className="bg-transparent font-medium outline-none cursor-pointer max-w-[150px] truncate pr-4 flex items-center gap-1 select-none"
                onClick={() => { setModelDropdownOpen(!modelDropdownOpen); setProviderDropdownOpen(false); }}
              >
                {model.split('/').pop()}
                <i className="ph-light ph-caret-down text-xxs text-app-textMuted absolute right-0 bg-transparent"></i>
              </div>
              
              <AnimatePresence>
                {modelDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-0 mt-1.5 w-56 bg-[var(--color-app-surface)] border border-app-border/30 rounded shadow-lg overflow-hidden flex flex-col py-1 max-h-64 overflow-y-auto custom-scrollbar"
                  >
                    {(models.length > 0 ? models : [{ id: model }]).map(m => (
                      <div 
                        key={m.id}
                        className={`px-3 py-2 text-xs cursor-pointer hover:bg-app-surface/60 transition-premium truncate shrink-0 leading-normal ${model === m.id ? 'text-app-textPrimary bg-app-surface/30' : 'text-app-textSecondary'}`}
                        onClick={() => {
                          setModel(m.id);
                          localStorage.setItem('selected_model', m.id);
                          setModelDropdownOpen(false);
                        }}
                        title={m.id}
                      >
                        {m.id.split('/').pop()}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </span>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex bg-app-surface/40 border border-app-border/30 rounded p-0.5">
             <button
               onClick={() => setWebSearchEnabled(!webSearchEnabled)}
               className={`px-2.5 py-1 text-xs rounded transition-premium flex items-center gap-1.5 ${webSearchEnabled ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}`}
               title="Toggle Web Search Tool"
             >
               <i className="ph-light ph-globe text-sm"></i>
               Search
             </button>
           </div>
           
           <div className="flex bg-app-surface/40 border border-app-border/30 rounded p-0.5">
             <button
               onClick={() => setAgentMode('build')}
               className={`px-2.5 py-1 text-xs rounded transition-premium ${agentMode === 'build' ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}`}
             >
               Build
             </button>
             <button
               onClick={() => setAgentMode('plan')}
               className={`px-2.5 py-1 text-xs rounded transition-premium ${agentMode === 'plan' ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}`}
             >
               Plan
             </button>
           </div>
           
           <div className="flex bg-app-surface/40 border border-app-border/30 rounded p-0.5">
             <button
               onClick={() => setViewMode('preview')}
               className={`p-1 rounded transition-premium ${viewMode === 'preview' ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}`}
             >
               <i className="ph-light ph-eye text-sm"></i>
             </button>
             <button
               onClick={() => setViewMode('raw')}
               className={`p-1 rounded transition-premium ${viewMode === 'raw' ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}`}
             >
               <i className="ph-light ph-code text-sm"></i>
             </button>
           </div>
        </div>
      </header>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4 md:px-0 pb-36 custom-scrollbar" id="chat-container">
        <div className="max-w-2xl mx-auto py-8 space-y-10">
          {messages.map((msg) => {
            if (msg.role === 'system') {
               return (
                 <div key={msg.id} className="text-center text-xs text-app-textMuted/70 my-2">
                   {msg.content}
                 </div>
               );
            }
            if (msg.role === 'tool') return null; // Tool results handled inside AI blocks
            
            if (msg.role === 'user') {
               return (
                 <div key={msg.id} className="flex justify-end">
                    <div className="bg-app-userBubble/60 border border-app-border/30 px-4 py-3 rounded-xl max-w-[85%] text-sm leading-relaxed text-app-textPrimary/95 whitespace-pre-wrap text-[16px]" style={{ fontFamily: '"Google Sans", "Noto Sans", sans-serif' }}>
                        {msg.content}
                    </div>
                 </div>
               );
            }

            // AI Block
            return (
              <div key={msg.id} className="text-sm leading-relaxed space-y-5">
                 <div className="space-y-4">
                   {viewMode === 'raw' ? (
                      <pre className="whitespace-pre-wrap font-mono text-[13px] text-app-textSecondary">
                        {msg.content}
                      </pre>
                   ) : (
                      <div className="markdown-body max-w-none text-[16px]" style={{ fontFamily: '"Noto Serif", serif' }}>
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={tokyoNight as any}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {msg.content}
                        </Markdown>
                      </div>
                   )}
                   
                   {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-4 flex flex-col gap-0 pl-1">
                        {msg.toolCalls.map((tc: any, i: number) => {
                           const toolResultMsg = messages.find(m => m.role === 'tool' && m.toolCallId === tc.id);
                           return (
                             <ToolCallView key={i} tc={tc} msg={msg} toolResultMsg={toolResultMsg} executePendingTools={executePendingTools} handleDeny={handleDeny} messages={messages} isLast={i === msg.toolCalls.length - 1} />
                           );
                        })}
                      </div>
                   )}
                 </div>
              </div>
            );
          })}
          
          {running && (
             <div className="flex items-center gap-2 text-xs text-app-textMuted">
                 <Loader2 className="w-3.5 h-3.5 animate-spin" />
                 <span>Claude is thinking...</span>
             </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-app-main via-app-main/95 to-transparent pt-12 pb-6 px-4 md:px-0 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          {showMentions && filteredFiles.length > 0 && (
            <div className="mb-2 w-full max-h-60 overflow-y-auto bg-app-surface/90 backdrop-blur border border-app-border/40 rounded-xl shadow-xl z-50 custom-scrollbar">
              {filteredFiles.map((file, i) => (
                <div 
                  key={file} 
                  className={`px-4 py-2 text-xs cursor-pointer truncate transition-premium ${i === mentionIndex ? 'bg-app-surfaceHover text-app-textPrimary' : 'text-app-textSecondary hover:bg-app-surface'}`}
                  onClick={() => insertMention(file)}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  {file}
                </div>
              ))}
            </div>
          )}
          
          <div className="bg-app-surface/80 backdrop-blur-md border border-app-border/40 rounded-xl shadow-xl flex flex-col focus-within:ring-1 focus-within:ring-app-border/80 focus-within:border-transparent transition-premium">
            <textarea 
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={running}
              rows={1} 
              placeholder={running ? "Claude is thinking..." : "Write a message... (@ to mention files)"} 
              className="w-full bg-transparent text-app-textPrimary placeholder-app-textMuted px-4 pt-3 pb-1 resize-none outline-none max-h-32 min-h-[48px] text-sm" 
            />
            
            <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
                <div className="flex items-center gap-1">
                    <button className="p-1.5 text-app-textMuted hover:text-app-textSecondary rounded hover:bg-app-surface/60 transition-premium" title="Add attachment">
                        <i className="ph-light ph-plus text-md"></i>
                    </button>
                    <button className="p-1.5 text-app-textMuted hover:text-app-textSecondary rounded hover:bg-app-surface/60 transition-premium" title="Use prompt">
                        <i className="ph-light ph-file-text text-md"></i>
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                       onClick={() => handleSubmit()} 
                       disabled={!input.trim() || running}
                       className="p-1.5 bg-app-textPrimary hover:bg-white text-app-main rounded-md disabled:opacity-30 disabled:bg-app-surface disabled:text-app-textMuted transition-premium flex items-center justify-center"
                    >
                       <i className="ph-bold ph-arrow-up text-sm"></i>
                    </button>
                </div>
            </div>
          </div>
          
          <div className="text-center mt-2 text-[10px] text-app-textMuted/75">
              Claude is AI and can make mistakes. Please double-check responses.
          </div>
        </div>
      </div>

      {/* Sessions Modal Overlay */}
      {showSessionsPanel && (
        <div className="fixed inset-0 bg-[var(--color-app-surface)]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-app-modalBg border border-app-border/50 rounded-lg w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border/20">
              <div className="flex items-center gap-2 text-app-textSecondary">
                <i className="ph-light ph-clock-counter-clockwise text-md"></i>
                <span className="text-xs font-semibold uppercase tracking-wider">Chat History</span>
              </div>
              <button 
                onClick={() => setShowSessionsPanel(false)}
                className="text-app-textMuted hover:text-app-textPrimary transition-premium"
              >
                <i className="ph-light ph-x text-md"></i>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2">
              <button
                onClick={createNewSession}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-app-surface border border-app-border/30 rounded text-sm text-app-textPrimary hover:bg-app-surfaceHover transition-premium mb-2"
              >
                <i className="ph-light ph-plus"></i> New Chat
              </button>
              
              {sessions.length === 0 ? (
                <div className="text-center text-app-textMuted text-sm py-8">No saved chats yet.</div>
              ) : (
                sessions.map(s => (
                  <div 
                    key={s.id} 
                    className={`flex items-center justify-between p-3 rounded border transition-premium cursor-pointer ${s.id === sessionId ? 'bg-app-surface/60 border-app-border' : 'bg-transparent border-transparent hover:bg-app-surface/40'}`}
                    onClick={() => loadSession(s.id)}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="text-sm text-app-textPrimary font-medium truncate pr-4">{s.name}</div>
                      <div className="text-xs text-app-textMuted">{new Date(s.updatedAt).toLocaleString()}</div>
                    </div>
                    <button 
                      onClick={(e) => deleteSession(s.id, e)}
                      className="text-app-textMuted hover:text-red-400 p-1 rounded hover:bg-app-surface flex-shrink-0"
                      title="Delete chat"
                    >
                      <i className="ph-light ph-trash"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connectors Modal Overlay */}
      {showMcpDialog && (
        <div className="fixed inset-0 bg-[var(--color-app-surface)]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-app-modalBg border border-app-border/50 rounded-lg w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border/20">
              <div className="flex items-center gap-2 text-app-textSecondary">
                <i className="ph-light ph-link text-md"></i>
                <span className="text-xs font-semibold uppercase tracking-wider">Connectors</span>
              </div>
              <button className="text-app-textMuted hover:text-app-textPrimary transition-premium" onClick={() => setShowMcpDialog(false)}>
                <i className="ph-light ph-x text-md"></i>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
               {mcpServers.length === 0 ? (
                 <div className="p-6 flex flex-col items-center justify-center text-center">
                     <div className="w-12 h-12 bg-app-surface border border-app-border/40 rounded-full flex items-center justify-center mb-4">
                         <i className="ph-light ph-plug text-xl text-app-textSecondary"></i>
                     </div>
                     <h3 className="text-sm font-semibold text-app-textPrimary">Connect MCP Server</h3>
                     <p className="text-xs text-app-textMuted mt-1 mb-6 max-w-[280px]">Extend your AI assistant with custom tools and integrations via the Model Context Protocol.</p>
                     
                     <div className="w-full flex gap-2">
                         <input 
                         type="text" 
                         placeholder="Enter SSE URL (e.g., http://localhost:3001/sse)" 
                         value={mcpInputUrl}
                         onChange={(e) => setMcpInputUrl(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleConnectMcp()}
                         className="flex-1 bg-app-surface border border-app-border/30 rounded px-3 py-1.5 text-xs text-app-textPrimary focus:outline-none focus:border-app-textSecondary transition-premium"
                         />
                         <button 
                         onClick={handleConnectMcp}
                         className="bg-app-textPrimary text-black px-4 py-1.5 rounded text-xs font-semibold hover:bg-white transition-premium"
                         >
                         Connect
                         </button>
                     </div>
                 </div>
               ) : (
                 <div className="flex flex-col gap-5">
                    <div className="w-full flex gap-2">
                         <input 
                         type="text" 
                         placeholder="Connect another SSE URL..." 
                         value={mcpInputUrl}
                         onChange={(e) => setMcpInputUrl(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleConnectMcp()}
                         className="flex-1 bg-app-surface border border-app-border/30 rounded px-3 py-1.5 text-xs text-app-textPrimary focus:outline-none focus:border-app-textSecondary transition-premium"
                         />
                         <button 
                         onClick={handleConnectMcp}
                         className="bg-app-surface text-app-textPrimary border border-app-border/30 px-3 py-1.5 rounded text-xs font-semibold hover:bg-app-surfaceHover transition-premium"
                         >
                         Add
                         </button>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-app-textSecondary">Connected Servers</h4>
                      {mcpServers.map(url => (
                        <div key={url} className="flex flex-col p-2.5 bg-app-surface/20 border border-app-border/20 rounded font-mono text-xs text-app-textSecondary mb-2 gap-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-[var(--color-app-surface)] border border-app-border/30 flex items-center justify-center text-xs font-semibold text-app-textPrimary">
                                        {getMcpName(url).charAt(0)}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="text-sm font-semibold text-app-textPrimary truncate">{getMcpName(url)}</div>
                                        <span className="truncate max-w-[200px] text-[10px]">{url}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleCopyUrl(url)} className="text-app-textMuted hover:text-app-textPrimary p-1 rounded transition-premium">
                                        <i className="ph-light ph-copy text-xs"></i>
                                    </button>
                                    <button
                                        onClick={() => handleDisconnectMcp(url)}
                                    className="px-2.5 py-1 text-xs text-app-textSecondary bg-[var(--color-app-surface)] hover:bg-app-surface border border-app-border/40 rounded transition-premium"
                                    >
                                    Disconnect
                                    </button>
                                </div>
                            </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-2 border-t border-app-border/20 space-y-3">
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-app-textSecondary">Tool permissions</h4>
                            <p className="text-[11px] text-app-textMuted mt-0.5">Control execution rules for individual operations.</p>
                        </div>
                        <div className="border border-app-border/40 rounded bg-[var(--color-app-surface)]">
                            <div className="flex items-center justify-between px-3 py-2 bg-app-surface/20 border-b border-app-border/40">
                                <button onClick={() => setMcpCollapsed(!mcpCollapsed)} className="flex items-center gap-2">
                                    <i className={`ph-light ${mcpCollapsed ? 'ph-caret-right' : 'ph-caret-down'} text-xxs text-app-textMuted`}></i>
                                    <span className="text-xs font-medium text-app-textPrimary">Available tools</span>
                                    <span className="bg-app-surface text-app-textMuted text-[9px] px-1.5 py-0.2 rounded-full">{getActiveMcpTools().length}</span>
                                </button>
                                
                                <div className="relative">
                                    <button
                                       onClick={() => setActivePresetMenu(activePresetMenu === 'mcp' ? null : 'mcp')}
                                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-app-surface hover:bg-app-surfaceHover text-app-textSecondary border border-app-border/40 rounded transition-premium"
                                    >
                                        <span>... {getPresetLabel('mcp')}</span>
                                        <i className="ph-light ph-caret-down text-[8px]"></i>
                                    </button>
                                    
                                    {activePresetMenu === 'mcp' && (
                                       <>
                                         <div className="fixed inset-0 z-40" onClick={() => setActivePresetMenu(null)} />
                                         <div className="absolute right-0 mt-1 w-28 bg-app-surface border border-app-border rounded shadow-xl z-50">
                                             <button onClick={() => applyPreset('mcp', 'allow')} className="w-full text-left px-2 py-1.5 text-[10px] text-app-textSecondary hover:text-app-textPrimary hover:bg-app-surfaceHover border-b border-app-border/10">Always allow</button>
                                             <button onClick={() => applyPreset('mcp', 'ask')} className="w-full text-left px-2 py-1.5 text-[10px] text-app-textSecondary hover:text-app-textPrimary hover:bg-app-surfaceHover border-b border-app-border/10">Ask each time</button>
                                             <button onClick={() => applyPreset('mcp', 'block')} className="w-full text-left px-2 py-1.5 text-[10px] text-app-textSecondary hover:text-app-textPrimary hover:bg-app-surfaceHover">Never allow</button>
                                         </div>
                                       </>
                                    )}
                                </div>
                            </div>
                            {!mcpCollapsed && (
                               <div className="divide-y divide-app-border/20 text-xs font-mono text-app-textSecondary max-h-64 overflow-y-auto custom-scrollbar">
                                  {getActiveMcpTools().map((tool: any) => {
                                      const name = tool.function.name;
                                      const permission = getToolPermission(name);
                                      return (
                                        <div key={name} className="flex items-center justify-between px-3 py-1.5 hover:bg-app-surface/20 transition-premium">
                                            <div className="flex flex-col min-w-0 pr-2">
                                              <span className="text-xs text-app-textSecondary tracking-tight truncate">{humanizeToolName(name)}</span>
                                              <span className="text-[9px] text-app-textMuted truncate font-sans">{tool.function.description}</span>
                                            </div>
                                            <div className="flex items-center gap-1 bg-[var(--color-app-surface)] p-0.5 rounded border border-app-border/10 shrink-0">
                                                <button onClick={() => setToolPermissions(prev => ({ ...prev, [name]: 'allow' }))} className={`w-5 h-5 flex items-center justify-center rounded transition-premium text-[10px] ${permission === 'allow' ? 'bg-app-surface text-app-textPrimary border border-app-borderLight/30' : 'text-app-textMuted border border-transparent hover:text-app-textSecondary'}`} title="Always Allow">
                                                    <i className="ph-bold ph-check"></i>
                                                </button>
                                                <button onClick={() => setToolPermissions(prev => ({ ...prev, [name]: 'ask' }))} className={`w-5 h-5 flex items-center justify-center rounded transition-premium text-[10px] ${permission === 'ask' ? 'bg-app-surface text-app-textPrimary border border-app-borderLight/30' : 'text-app-textMuted border border-transparent hover:text-app-textSecondary'}`} title="Ask each time">
                                                    <i className="ph-bold ph-hand-palm"></i>
                                                </button>
                                                <button onClick={() => setToolPermissions(prev => ({ ...prev, [name]: 'block' }))} className={`w-5 h-5 flex items-center justify-center rounded transition-premium text-[10px] ${permission === 'block' ? 'bg-app-surface text-app-textPrimary border border-app-borderLight/30' : 'text-app-textMuted border border-transparent hover:text-app-textSecondary'}`} title="Never Allow">
                                                    <i className="ph-bold ph-prohibit"></i>
                                                </button>
                                            </div>
                                        </div>
                                      );
                                  })}
                               </div>
                            )}
                        </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}