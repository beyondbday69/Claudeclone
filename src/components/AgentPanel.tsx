import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tokyoNight } from '../utils/tokyoNight';
import { Bot, Terminal, ArrowUp, Check, Loader2, Eye, Code, Link2, User, ArrowLeft, X, ChevronDown, ChevronUp, Copy, MoreVertical, Hand, Ban } from 'lucide-react';
import { Octokit } from '@octokit/rest';
import { getTools, executeTool, isRiskyTool, getSystemPrompt } from '../utils/githubTools';
import { connectMcp, getMcpTools, executeMcpTool, getMcpToolsForUrl } from '../utils/mcpClient';
import { db } from '../utils/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit } from 'firebase/firestore';

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

const MessageItem = React.memo(({ msg, viewMode, messages, executePendingTools, handleDeny, ToolGroupViewComponent }: any) => {
  if (msg.role === 'system') {
     return (
       <div className="text-center text-xs text-app-textMuted/70 my-2">
         {msg.content}
       </div>
     );
  }
  if (msg.role === 'tool') return null;
  
  if (msg.role === 'user') {
     return (
       <div className="flex justify-end">
          <div className="bg-app-userBubble/60 border border-app-border/30 px-4 py-3 rounded-xl max-w-[85%] text-sm leading-relaxed text-app-textPrimary/95 whitespace-pre-wrap text-[16px]" style={{ fontFamily: '"Google Sans", "Noto Sans", sans-serif' }}>
              {msg.content}
          </div>
       </div>
     );
  }

  if ((!msg.content || msg.content.trim() === '') && (!msg.toolCalls || msg.toolCalls.length === 0)) {
     return null;
  }

  return (
    <div className="text-sm leading-relaxed space-y-5 group">
       <div className="space-y-4">
         {msg.content && (
           viewMode === 'raw' ? (
              <pre className="whitespace-pre-wrap font-mono text-[13px] text-app-textSecondary">
                {msg.content}
              </pre>
           ) : (
              <div className="markdown-body max-w-none text-[16px]" style={{ fontFamily: '"Noto Serif", serif' }}>
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table({ children, ...props }: any) {
                      return (
                        <div className="w-full overflow-x-auto my-6 rounded-xl border border-[var(--color-app-borderLight)] shadow-sm bg-app-surface/20">
                          <table className="w-full text-left border-collapse text-sm !m-0" {...props}>
                            {children}
                          </table>
                        </div>
                      );
                    },
                    thead({ children, ...props }: any) {
                      return <thead className="bg-[#1a1b26]/50 text-app-textSecondary uppercase tracking-wider text-[11px] border-b border-[var(--color-app-borderLight)]" {...props}>{children}</thead>;
                    },
                    th({ children, ...props }: any) {
                      return <th className="px-4 py-3 font-semibold" {...props}>{children}</th>;
                    },
                    td({ children, ...props }: any) {
                      return <td className="px-4 py-3 text-app-textPrimary" {...props}>{children}</td>;
                    },
                    tr({ children, ...props }: any) {
                      return <tr className="hover:bg-app-surface/60 transition-colors border-b border-[var(--color-app-borderLight)]/50 border-t-0 last:border-b-0" {...props}>{children}</tr>;
                    },
                    pre({ children }: any) {
                      return <>{children}</>;
                    },
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const content = String(children).replace(/\n$/, '');

                      return !inline && match ? (
                        <div className="my-4 rounded-xl overflow-hidden border border-[var(--color-app-borderLight)] shadow-sm bg-[#252523]">
                          <div className="px-4 pt-3 pb-1 bg-transparent flex items-center justify-between select-none">
                            <span className="text-xs font-mono text-app-textMuted lowercase font-medium">{match[1]}</span>
                          </div>
                          <SyntaxHighlighter
                            style={tokyoNight as any}
                            language={match[1]}
                            PreTag="div"
                            className="text-sm font-mono custom-scrollbar !m-0 !bg-transparent"
                            customStyle={{ backgroundColor: 'transparent', padding: '1rem', margin: 0 }}
                            {...props}
                          >
                            {content}
                          </SyntaxHighlighter>
                        </div>
                      ) : (
                        <code className="bg-[var(--color-app-surfaceHover)] text-[var(--color-app-accent)] px-1.5 py-0.5 rounded-md font-mono text-sm border border-[var(--color-app-borderLight)]" {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {msg.content}
                </Markdown>
              </div>
           )
         )}
         
         {msg.toolCalls && msg.toolCalls.length > 0 && (
            <ToolGroupViewComponent msg={msg} messages={messages} executePendingTools={executePendingTools} handleDeny={handleDeny} />
         )}
       </div>
    </div>
  );
}, (prevProps, nextProps) => {
   return prevProps.msg.content === nextProps.msg.content && 
          prevProps.viewMode === nextProps.viewMode && 
          JSON.stringify(prevProps.msg.toolCalls) === JSON.stringify(nextProps.msg.toolCalls) &&
          (prevProps.msg.toolCalls || []).every((tc: any) => {
             const prevRes = prevProps.messages.find((m:any) => m.role === 'tool' && m.toolCallId === tc.id);
             const nextRes = nextProps.messages.find((m:any) => m.role === 'tool' && m.toolCallId === tc.id);
             return prevRes === nextRes;
          }) &&
          (prevProps.messages.some((m:any) => m.role === 'assistant' && prevProps.messages.indexOf(m) > prevProps.messages.indexOf(prevProps.msg)) === 
           nextProps.messages.some((m:any) => m.role === 'assistant' && nextProps.messages.indexOf(m) > nextProps.messages.indexOf(nextProps.msg)));
});
export default function AgentPanel({ owner, repo, branch, octokit }: AgentPanelProps) {
  const [mcpReloadState, setMcpReloadState] = useState(0);
  useEffect(() => {
    const savedActive = localStorage.getItem('active_mcp_servers');
    const allSaved = localStorage.getItem('mcp_servers');
    const activeUrls = savedActive ? JSON.parse(savedActive) : (allSaved ? JSON.parse(allSaved) : []);
    
    activeUrls.forEach((url: string) => {
        connectMcp(url).then(res => {
            if (res.success) {
                setMcpReloadState(prev => prev + 1);
            }
        }).catch(console.error);
    });
  }, []);

  const saveMcpConnectionState = (url: string, connected: boolean) => {
    const saved = localStorage.getItem('active_mcp_servers');
    let active = saved ? JSON.parse(saved) : null;
    if (!active) {
      const allSaved = localStorage.getItem('mcp_servers');
      active = allSaved ? JSON.parse(allSaved) : [];
    }
    if (connected && !active.includes(url)) {
      active.push(url);
    } else if (!connected) {
      active = active.filter((u: string) => u !== url);
    }
    localStorage.setItem('active_mcp_servers', JSON.stringify(active));
  };

  const [model, setModel] = useState<string>(() => localStorage.getItem('selected_model') || 'deepseek-ai/deepseek-v4-flash');
  const [provider, setProvider] = useState<string>(() => localStorage.getItem('selected_provider') || 'opencode');
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [showAddConnectorModal, setShowAddConnectorModal] = useState(false);
  const [activeConnectorTab, setActiveConnectorTab] = useState('All');
  const [showAdvancedConnectorSettings, setShowAdvancedConnectorSettings] = useState(false);
  const [selectedConnectorUrl, setSelectedConnectorUrl] = useState<string | null>(null);
  const [showConnectorTools, setShowConnectorTools] = useState(true);
  const [showGlobalPermissionDropdown, setShowGlobalPermissionDropdown] = useState(false);
  const [showConnectorMenu, setShowConnectorMenu] = useState(false);
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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      try {
        const q = query(collection(db, 'chat_sessions'), orderBy('updatedAt', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        const loaded: ChatSession[] = [];
        snapshot.forEach(doc => {
          loaded.push(doc.data() as ChatSession);
        });
        setSessions(loaded);
        setSessionsLoaded(true);
      } catch (err) {
        console.error("Failed to load sessions from Firebase", err);
        const saved = localStorage.getItem('chat_sessions');
        if (saved) setSessions(JSON.parse(saved));
        setSessionsLoaded(true);
      }
    }
    loadSessions();
  }, []);
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
  
  interface ArtifactData {
    id: string;
    title: string;
    language: string;
    content: string;
  }
  const [activeArtifact, setActiveArtifact] = useState<ArtifactData | null>(null);
  
  const [agentMode, setAgentMode] = useState<'build' | 'plan'>('build');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [showMcpDialog, setShowMcpDialog] = useState(false);
  const [mcpInputUrl, setMcpInputUrl] = useState('');
  const [mcpInputName, setMcpInputName] = useState('');
  const [mcpServerNames, setMcpServerNames] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('mcp_server_names');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('mcp_server_names', JSON.stringify(mcpServerNames));
  }, [mcpServerNames]);

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
    if (messages.length > 1 && sessionsLoaded) {
      const name = messages.find(m => m.role === 'user')?.content.slice(0, 40) || 'New Chat';
      const newSession = {
        id: sessionId,
        name,
        updatedAt: Date.now(),
        messages
      };

      setSessions(prevSessions => {
        const updatedSessions = prevSessions.filter(s => s.id !== sessionId);
        const newSessions = [newSession, ...updatedSessions].slice(0, 50); // keep last 50
        localStorage.setItem('chat_sessions', JSON.stringify(newSessions));
        return newSessions;
      });

      setDoc(doc(db, "chat_sessions", sessionId), newSession).catch(err => {
        console.error("Failed to save session to Firebase", err);
      });
    }
  }, [messages, sessionId, sessionsLoaded]);

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
    deleteDoc(doc(db, "chat_sessions", id)).catch(err => {
      console.error("Failed to delete session from Firebase", err);
    });
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
      if (mcpServerNames[urlStr]) return mcpServerNames[urlStr];
      try {
        const u = new URL(urlStr);
        return u.hostname;
      } catch (e) {
        return urlStr;
      }
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
    const url = mcpInputUrl.trim();
    const result = await connectMcp(url);
    if (result.success) {
       saveMcpConnectionState(url, true);
       if (!mcpServers.includes(url)) {
           setMcpServers([...mcpServers, url]);
       }
       if (mcpInputName.trim()) {
           setMcpServerNames(prev => ({ ...prev, [url]: mcpInputName.trim() }));
       }
       setMcpInputUrl('');
       setMcpInputName('');
       setShowAddConnectorModal(false);
       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Connected to MCP server. ${result.tools?.length || 0} tools loaded.` }]);
    } else {
       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Failed to connect to MCP server. Error: ${result.error}` }]);
       alert("Failed to connect: " + result.error);
    }
  };

  const handleDisconnectMcp = (url: string) => {
    disconnectMcp(url);
    saveMcpConnectionState(url, false);
    setMcpReloadState(prev => prev + 1);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Disconnected from MCP server ${url}.` }]);
  };

  const handleRemoveMcp = (url: string) => {
    disconnectMcp(url);
    saveMcpConnectionState(url, false);
    setMcpServers(mcpServers.filter(u => u !== url));
    setMcpReloadState(prev => prev + 1);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Removed MCP server ${url}.` }]);
  };

  const scrollTarget = useRef<number | null>(null);
  const isScrolling = useRef(false);
  const userScrolledUp = useRef(false);

  const handleUserScroll = () => {
    isScrolling.current = false;
    scrollTarget.current = null;
    userScrolledUp.current = true;
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 50) {
      userScrolledUp.current = false;
    }
  };

  const scrollToBottom = (force = false) => {
    const container = document.getElementById('chat-container');
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      return;
    }
    
    if (userScrolledUp.current && !force) return;
    if (force) userScrolledUp.current = false;
    
    scrollTarget.current = container.scrollHeight - container.clientHeight;
    
    if (!isScrolling.current) {
      isScrolling.current = true;
      const step = () => {
        if (scrollTarget.current === null) {
          isScrolling.current = false;
          return;
        }
        
        const currentTop = container.scrollTop;
        const targetTop = scrollTarget.current;
        const diff = targetTop - currentTop;
        
        if (Math.abs(diff) < 1) {
          container.scrollTop = targetTop;
          isScrolling.current = false;
          scrollTarget.current = null;
        } else {
          container.scrollTop = currentTop + diff * 0.15;
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    }
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
    scrollToBottom(true);
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

const ToolGroupView = ({ msg, messages, executePendingTools, handleDeny }: any) => {
  const allToolsComplete = msg.toolCalls.every((tc: any) => messages.some((m: any) => m.role === 'tool' && m.toolCallId === tc.id));
  const hasSubsequentMessage = messages.some((m: any) => m.role === 'assistant' && messages.indexOf(m) > messages.indexOf(msg));
  const shouldCollapseByDefault = allToolsComplete && hasSubsequentMessage;
  
  const [expanded, setExpanded] = useState(!shouldCollapseByDefault);

  useEffect(() => {
    if (shouldCollapseByDefault && expanded) {
       setExpanded(false);
    }
  }, [shouldCollapseByDefault]);

  return (
    <div className="mt-4 flex flex-col gap-0 pl-1 relative">
      {shouldCollapseByDefault && (
        <div className="relative py-1 group">
          {expanded && <div className="absolute left-[7px] top-[24px] bottom-[-8px] w-[1px] bg-app-border z-0"></div>}
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs font-mono text-app-textSecondary hover:text-app-textPrimary transition-premium py-1 group w-full mb-1"
          >
            <div className="w-4 flex justify-center bg-app-main relative z-10">
              <i className="ph-light ph-wrench text-sm text-app-textMuted group-hover:text-app-textSecondary transition-colors"></i>
            </div>
            <span className="font-semibold capitalize">Used {msg.toolCalls.length} tool{msg.toolCalls.length !== 1 ? 's' : ''}</span>
            <i className={`ph-light ${expanded ? 'ph-caret-down' : 'ph-caret-right'} text-[10px]`}></i>
          </button>
        </div>
      )}
      
      <AnimatePresence>
        {(!shouldCollapseByDefault || expanded) && (
          <motion.div
            initial={shouldCollapseByDefault ? { opacity: 0, filter: 'blur(4px)', height: 0 } : false}
            animate={{ opacity: 1, filter: 'blur(0px)', height: 'auto' }}
            exit={{ opacity: 0, filter: 'blur(4px)', height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-0 overflow-hidden"
          >
            {msg.toolCalls.map((tc: any, i: number) => {
               const toolResultMsg = messages.find((m: any) => m.role === 'tool' && m.toolCallId === tc.id);
               return (
                 <ToolCallView key={i} tc={tc} msg={msg} toolResultMsg={toolResultMsg} executePendingTools={executePendingTools} handleDeny={handleDeny} messages={messages} isLast={i === msg.toolCalls.length - 1} />
               );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
      {!isLast && (
         <div className="absolute left-[7px] top-[24px] bottom-[-8px] w-[1px] bg-app-border z-0"></div>
      )}
      <div className="flex flex-col gap-2 relative z-10">
        <button 
          className="w-full flex items-center justify-between text-xs font-mono text-app-textSecondary hover:text-app-textPrimary transition-premium rounded py-1" 
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <div className="w-4 flex justify-center bg-app-main relative z-10">
              <i className={`ph-light ${getToolIcon(tc.function.name)} text-sm text-app-textMuted`}></i>
            </div>
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
            className="ml-[7px] pl-4 py-1 text-xs font-mono bg-app-codeBg text-app-textSecondary mb-2 relative border-l-2 border-app-border before:absolute before:left-0 before:top-0 before:w-3 before:border-t-2 before:border-app-border after:absolute after:left-0 after:bottom-0 after:w-3 after:border-b-2 after:border-app-border rounded-r"
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
                <div className="p-3 border-t md:border-t-0 md:border-l border-app-border/30 overflow-hidden">
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
  <div className="flex w-full h-full overflow-hidden relative">
    {/* Mobile Overlay */}
    <AnimatePresence>
      {showSessionsPanel && (
        <motion.div 
           initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
           className="md:hidden fixed inset-0 bg-black/50 z-40"
           onClick={() => setShowSessionsPanel(false)}
        />
      )}
    </AnimatePresence>

    {/* Unified Expanding Sidebar */}
    <motion.aside
      initial={false}
      animate={{ width: showSessionsPanel ? (window.innerWidth < 768 ? '80%' : 260) : (window.innerWidth < 768 ? 0 : 56) }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={`h-full bg-[#1C1C1A] border-r border-[var(--color-app-border)] shrink-0 flex flex-col z-50 absolute md:relative left-0 top-0 overflow-hidden shadow-2xl md:shadow-none ${!showSessionsPanel ? 'max-md:hidden' : ''}`}
    >
      <div className="flex flex-col h-full min-w-[260px] w-[260px]">
        {/* Toggle Button Area */}
        <div className="flex items-center justify-between px-2.5 pt-3 pb-2 shrink-0">
           <span className={`text-2xl font-serif font-semibold text-app-textPrimary pl-1.5 whitespace-nowrap transition-opacity duration-150 ${showSessionsPanel ? 'opacity-100' : 'opacity-0'}`}>
             Claude
           </span>
           <div className={`transition-all duration-200 ${showSessionsPanel ? 'transform translate-x-0' : 'transform -translate-x-[204px]'}`}>
             <button onClick={() => setShowSessionsPanel(!showSessionsPanel)} className="text-app-textMuted hover:text-app-textPrimary transition-premium p-1.5 rounded-lg hover:bg-app-surface">
               <span className="material-symbols-outlined text-[22px]">
                 {showSessionsPanel ? 'left_panel_close' : 'left_panel_open'}
               </span>
             </button>
           </div>
        </div>
        
        {/* Action Buttons Area */}
        <div className="px-2.5 pb-3 border-b border-[var(--color-app-borderLight)] shrink-0 flex flex-col gap-1">
           <button 
             onClick={createNewSession}
             className="flex items-center gap-2 w-full p-1.5 rounded-lg hover:bg-app-surface text-app-textPrimary transition-premium overflow-hidden"
             title="New Chat"
           >
             <span className="material-symbols-outlined text-[20px] shrink-0 text-[#faf9f5]">edit_square</span>
             <span className={`text-[#faf9f5] text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${showSessionsPanel ? 'opacity-100' : 'opacity-0'}`}>
               New chat
             </span>
           </button>

           <button 
             onClick={() => setShowCustomizeModal(true)}
             className="flex items-center gap-2 w-full p-1.5 rounded-lg hover:bg-[var(--color-app-surface)] text-app-textPrimary transition-premium overflow-hidden"
             title="Customize"
           >
             <span className="material-symbols-outlined text-[20px] shrink-0 text-[#faf9f5]">home_repair_service</span>
             <span className={`text-[#faf9f5] text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${showSessionsPanel ? 'opacity-100' : 'opacity-0'}`}>
               Customize
             </span>
           </button>
        </div>
        
        {/* Chat List */}
        <div className={`p-3 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-1 transition-opacity duration-150 ${showSessionsPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="px-2 pt-2 pb-1 text-xs font-semibold text-[#a09d96] whitespace-nowrap">
            Recents
          </div>
          
          {sessions.length === 0 ? (
            <div className="text-center text-app-textMuted text-xs py-8">No saved chats yet.</div>
          ) : (
            sessions.map(s => (
              <div 
                key={s.id} 
                className={`flex items-center justify-between p-2.5 rounded transition-premium cursor-pointer group ${s.id === sessionId ? 'bg-app-surfaceHover text-app-textPrimary' : 'text-app-textSecondary hover:bg-[var(--color-app-surfaceHover)]'}`}
                onClick={() => loadSession(s.id)}
              >
                <div className="flex flex-col min-w-0">
                  <div className="text-sm font-medium truncate pr-2">{s.name}</div>
                  <div className="text-[10px] text-app-textMuted">{new Date(s.updatedAt).toLocaleDateString()}</div>
                </div>
                <button 
                  onClick={(e) => deleteSession(s.id, e)}
                  className="text-app-textMuted hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  title="Delete chat"
                >
                  <i className="ph-light ph-trash"></i>
                </button>
              </div>
            ))
          )}
        </div>


      </div>
    </motion.aside>

    <main className="flex-1 flex flex-col h-full relative min-w-0 bg-app-main text-app-textPrimary font-sans antialiased selection:bg-app-surfaceHover selection:text-white">
      {/* Top Bar */}
      <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-app-border/10 shrink-0 gap-3 lg:gap-0">
        <div className="flex flex-wrap items-center gap-y-2 gap-x-1 text-xs text-app-textSecondary w-full lg:w-auto">
          {!showSessionsPanel && (
            <button 
              className="md:hidden text-app-textMuted hover:text-app-textPrimary transition-premium flex items-center justify-center p-1 rounded hover:bg-app-surface/60" 
              onClick={() => setShowSessionsPanel(true)}
              title="Open Sidebar"
            >
              <span className="material-symbols-outlined text-[22px]">left_panel_open</span>
            </button>
          )}

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

        <div className="flex flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto">

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
      <div 
        className="flex-1 overflow-y-auto px-4 md:px-0 pb-36 custom-scrollbar" 
        id="chat-container"
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        onScroll={handleScroll}
      >
        <div className="max-w-2xl mx-auto py-8 space-y-10">
          {(() => {
             const processedMessages = messages.map(m => ({...m}));
             for (let i = 0; i < processedMessages.length; i++) {
                const msg = processedMessages[i];
                if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
                   let nextAssistantIndex = i;
                   while (true) {
                      let nextIdx = -1;
                      for (let j = nextAssistantIndex + 1; j < processedMessages.length; j++) {
                         if (processedMessages[j].role !== 'tool' && processedMessages[j].role !== 'system') {
                            nextIdx = j;
                            break;
                         }
                      }
                      if (nextIdx !== -1 && processedMessages[nextIdx].role === 'assistant') {
                         const nextMsg = processedMessages[nextIdx];
                         if (!nextMsg.content || nextMsg.content.trim() === '') {
                            if (nextMsg.toolCalls && nextMsg.toolCalls.length > 0) {
                               msg.toolCalls = [...msg.toolCalls, ...nextMsg.toolCalls];
                            }
                            nextMsg.toolCalls = [];
                            nextAssistantIndex = nextIdx;
                            continue;
                         }
                      }
                      break;
                   }
                }
             }
             
             return processedMessages.map((msg) => (
               <MessageItem 
                 key={msg.id} 
                 msg={msg} 
                 viewMode={viewMode} 
                 messages={messages} 
                 executePendingTools={executePendingTools} 
                 handleDeny={handleDeny} 
                 ToolGroupViewComponent={ToolGroupView} 
               />
             ));
          })()}
          
          {running && (
             <div className="flex items-center gap-2 text-xs">
                 <span className="animate-shimmer font-medium">Claude is thinking...</span>
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
                    <button 
                        onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                        className={`group relative p-1.5 rounded hover:bg-app-surface/60 transition-premium ${webSearchEnabled ? 'text-[#faf9f5]' : 'text-app-textMuted hover:text-app-textSecondary'}`} 
                    >
                        <i className="ph-light ph-globe text-md"></i>
                        <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#252320] border border-app-border/40 text-app-textSecondary text-[11px] font-medium px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-50">
                            Web Search
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#252320] border-r border-b border-app-border/40 rotate-45"></div>
                        </span>
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



      {/* Connectors Modal Overlay */}
      <AnimatePresence>
        {showMcpDialog && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[var(--color-app-surface)]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-app-modalBg border border-app-border/50 rounded-lg w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
            >
            
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>

    <AnimatePresence>
      {false && activeArtifact && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: window.innerWidth < 768 ? '100%' : '50%', opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="h-full bg-app-surface border-l border-app-border shrink-0 flex flex-col overflow-hidden z-20 absolute md:relative right-0 top-0"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-app-border bg-app-surfaceHover">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-app-accent" />
              <span className="text-sm font-medium">{activeArtifact.title}</span>
              <span className="px-2 py-0.5 rounded text-xs bg-app-surface border border-app-border text-app-textSecondary">{activeArtifact.language}</span>
            </div>
            <div className="flex items-center gap-2">
               <button 
                 onClick={() => {
                   navigator.clipboard.writeText(activeArtifact.content);
                 }}
                 className="p-1.5 rounded hover:bg-app-surface text-app-textSecondary transition-colors"
                 title="Copy code"
               >
                 <Copy className="w-4 h-4" />
               </button>
               <button 
                 onClick={() => setActiveArtifact(null)}
                 className="p-1.5 rounded hover:bg-app-surface text-app-textSecondary transition-colors"
               >
                 <X className="w-4 h-4" />
               </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-[#1a1b26]">
            <SyntaxHighlighter
              style={tokyoNight as any}
              language={activeArtifact.language}
              PreTag="div"
              className="text-sm font-mono !bg-transparent !m-0"
            >
              {activeArtifact.content}
            </SyntaxHighlighter>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Customize Modal */}
    <AnimatePresence>
      {showCustomizeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/[.13] backdrop-blur-[2px]"
            onClick={() => setShowCustomizeModal(false)}
          />
          
          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-[1024px] h-[650px] max-w-[95vw] max-h-[90vh] bg-app-main rounded-2xl overflow-hidden flex border border-app-border/50"
          >
            {/* Top Right Action Buttons */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <button className="p-1.5 rounded-lg text-app-textMuted hover:text-app-textPrimary hover:bg-app-surface transition-colors flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </button>
              <button 
                onClick={() => setShowAddConnectorModal(true)}
                className="flex items-center gap-1 px-4 py-1.5 bg-[#161615] border border-app-border/20 rounded-lg text-sm font-medium text-app-textPrimary hover:bg-app-surface transition-colors shadow-sm"
              >
                Add
                <span className="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
              </button>
              <button 
                onClick={() => setShowCustomizeModal(false)}
                className="p-1.5 rounded-lg hover:bg-app-surface text-app-textMuted hover:text-app-textPrimary transition-premium"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Left Column (20% Strip Color) */}
            <div className="w-[20%] bg-[#1C1C1A] border-r border-app-border/30 p-3 flex flex-col gap-1">
              <h2 className="text-xs font-semibold text-app-textSecondary px-2 py-2 mb-1">Customize</h2>
              
              <button className="flex items-center gap-2.5 w-full p-2 rounded-lg bg-[var(--color-app-surfaceHover)] text-app-textPrimary transition-premium text-left">
                <span className="material-symbols-outlined text-[18px] text-[#cc785c] shrink-0">cable</span>
                <span className="text-sm font-medium">Connectors</span>
              </button>
            </div>
            
            {/* Right Column (80% Chat Bg Color) */}
            <div className="flex-1 bg-app-main p-8 flex flex-col relative overflow-hidden">
              <AnimatePresence mode="wait">
                {selectedConnectorUrl ? (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(8px)' }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col h-full overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-8 pr-24">
                      <button 
                        onClick={() => setSelectedConnectorUrl(null)}
                        className="flex items-center gap-2 text-app-textSecondary hover:text-app-textPrimary transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        <span className="text-lg font-semibold text-app-textPrimary">Connectors</span>
                      </button>
                    </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[#2a2a28] border border-app-border/30 flex items-center justify-center text-xl font-bold text-app-textPrimary">
                        {getMcpName(selectedConnectorUrl).charAt(0)}
                      </div>
                      <h2 className="text-2xl font-bold text-app-textPrimary">{getMcpName(selectedConnectorUrl)}</h2>
                    </div>
                    <div className="flex items-center gap-3 relative">
                      {getConnectedMcpUrls().includes(selectedConnectorUrl) ? (
                        <button 
                          onClick={() => { handleDisconnectMcp(selectedConnectorUrl); }}
                          className="px-4 py-1.5 rounded-lg border border-app-border/50 text-app-textPrimary text-sm font-medium hover:bg-app-surface transition-colors"
                        >
                          Disconnect
                        </button>
                      ) : (
                        <button 
                          onClick={async () => {
                            const res = await connectMcp(selectedConnectorUrl);
                            if (res.success) {
                                saveMcpConnectionState(selectedConnectorUrl, true);
                            }
                            setMcpReloadState(prev => prev + 1);
                          }}
                          className="px-4 py-1.5 rounded-lg border border-app-border/50 text-app-textPrimary text-sm font-medium bg-app-surface hover:bg-app-surface/80 transition-colors"
                        >
                          Connect
                        </button>
                      )}
                      <button 
                        onClick={() => setShowConnectorMenu(!showConnectorMenu)}
                        className="p-1 rounded-md text-app-textMuted hover:text-app-textPrimary hover:bg-app-surface transition-colors"
                      >
                        <span className="material-symbols-outlined text-[24px]">more_vert</span>
                      </button>
                      
                      <AnimatePresence>
                        {showConnectorMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-full right-0 mt-2 w-48 bg-[#1e1e1d] border border-app-border/50 rounded-lg shadow-xl overflow-hidden z-50 py-1"
                          >
                            <button 
                              onClick={async () => {
                                setShowConnectorMenu(false);
                                const res = await connectMcp(selectedConnectorUrl);
                                if (res.success) {
                                    saveMcpConnectionState(selectedConnectorUrl, true);
                                }
                                setMcpReloadState(prev => prev + 1);
                              }} 
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-app-textPrimary hover:bg-app-surface/50 text-left transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">sync</span> Refresh tools list
                            </button>
                            <button 
                              onClick={() => {
                                setShowConnectorMenu(false);
                                handleRemoveMcp(selectedConnectorUrl);
                                setSelectedConnectorUrl(null);
                              }} 
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 text-left transition-colors"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span> Remove
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-8">
                    <span className="text-xs text-app-textMuted font-mono bg-app-surface px-2 py-1 rounded border border-app-border/30">{selectedConnectorUrl}</span>
                    <button className="text-app-textMuted hover:text-app-textPrimary transition-colors">
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                  </div>
                  
                  <div className="flex-1 flex flex-col min-h-0 pr-2">
                    <div className="mb-6 shrink-0">
                      <h3 className="text-sm font-semibold text-app-textPrimary mb-1">Tool permissions</h3>
                      <p className="text-sm text-app-textMuted">Choose when Claude is allowed to use these tools.</p>
                    </div>
                    
                    <div className="flex items-center justify-between mb-4 border-b border-app-border/30 pb-2 shrink-0">
                      <button 
                        onClick={() => setShowConnectorTools(!showConnectorTools)}
                        className="flex items-center gap-2 text-sm font-semibold text-app-textPrimary hover:text-app-textSecondary transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showConnectorTools ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                        </span>
                        Other tools
                        <span className="px-1.5 py-0.5 rounded-full bg-app-surface text-app-textMuted text-[11px]">{getMcpToolsForUrl(selectedConnectorUrl).length}</span>
                      </button>
                      
                      {(() => {
                        const tools = getMcpToolsForUrl(selectedConnectorUrl);
                        const allState = tools.length > 0 && tools.every(t => getToolPermission(t.function.name) === getToolPermission(tools[0].function.name)) 
                          ? getToolPermission(tools[0].function.name) 
                          : 'mixed';
                        
                        const display = {
                          allow: { icon: 'done_all', text: 'Allow all', color: 'text-white' },
                          ask: { icon: 'front_hand', text: 'Needs approval', color: 'text-white' },
                          block: { icon: 'block', text: 'Deny all', color: 'text-white' },
                          mixed: { icon: 'tune', text: 'Mixed permissions', color: 'text-app-textMuted' },
                        }[allState];

                        const setAll = (mode: 'allow' | 'ask' | 'block') => {
                          setToolPermissions(prev => {
                            const updated = { ...prev };
                            tools.forEach(t => {
                              updated[t.function.name] = mode;
                            });
                            return updated;
                          });
                          setShowGlobalPermissionDropdown(false);
                        };

                        return (
                          <div className="relative">
                            <button 
                              onClick={() => setShowGlobalPermissionDropdown(!showGlobalPermissionDropdown)}
                              className="flex items-center px-3 py-1 rounded-lg border border-app-border/50 text-xs font-medium text-app-textPrimary hover:bg-app-surface transition-colors"
                            >
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={allState}
                                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                                  transition={{ duration: 0.15 }}
                                  className="flex items-center gap-1.5"
                                >
                                  <span className={`material-symbols-outlined text-[16px] ${display.color}`}>{display.icon}</span>
                                  <span>{display.text}</span>
                                </motion.div>
                              </AnimatePresence>
                              <span className="material-symbols-outlined text-[16px] ml-1.5">keyboard_arrow_down</span>
                            </button>
                            
                            <AnimatePresence>
                              {showGlobalPermissionDropdown && (
                                <motion.div
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -5 }}
                                  className="absolute top-full right-0 mt-2 w-48 bg-[#1e1e1d] border border-app-border/50 rounded-lg shadow-xl overflow-hidden z-50 py-1"
                                >
                                  <button onClick={() => setAll('allow')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-app-textPrimary hover:bg-app-surface/50 text-left transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">done_all</span> Allow all
                                  </button>
                                  <button onClick={() => setAll('ask')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-app-textPrimary hover:bg-app-surface/50 text-left transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">front_hand</span> Needs approval
                                  </button>
                                  <button onClick={() => setAll('block')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-app-textPrimary hover:bg-app-surface/50 text-left transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">block</span> Deny all
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })()}
                    </div>
                    
                    <AnimatePresence>
                      {showConnectorTools && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="flex flex-col flex-1 overflow-y-auto custom-scrollbar min-h-0 pr-2 pb-4"
                        >
                          {getMcpToolsForUrl(selectedConnectorUrl).map((tool, idx) => (
                            <div key={idx} className="flex items-center justify-between py-3 border-b border-app-border/20 last:border-0 hover:bg-app-surface/30 px-2 rounded-lg transition-colors">
                              <span className="text-sm text-app-textPrimary">{tool.function.name}</span>
                              <div className="flex items-center bg-[#161615] border border-app-border/20 rounded-lg p-0.5">
                                {(['allow', 'ask', 'block'] as const).map(mode => (
                                  <button
                                    key={mode}
                                    onClick={() => setToolPermissions(prev => ({ ...prev, [tool.function.name]: mode }))}
                                    className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                                      getToolPermission(tool.function.name) === mode ? 'text-white' : 'text-app-textMuted hover:text-white'
                                    }`}
                                    title={mode === 'allow' ? "Allow" : mode === 'ask' ? "Needs approval" : "Deny"}
                                  >
                                    {getToolPermission(tool.function.name) === mode && (
                                      <motion.div
                                        layoutId={`permission-${tool.function.name}`}
                                        className="absolute inset-0 bg-app-surface border border-app-border/50 rounded-md shadow-sm"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                      />
                                    )}
                                    <span className="material-symbols-outlined text-[18px] relative z-10">
                                      {mode === 'allow' ? 'check' : mode === 'ask' ? 'front_hand' : 'block'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(8px)' }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col h-full overflow-hidden"
                  >
                    <h1 className="text-xl font-semibold mb-4 pr-24">Connectors</h1>
                  
                  <div className="flex items-center bg-[#161615] border border-app-border/20 rounded-lg p-0.5 w-fit mb-6">
                    {['All', 'Connected', 'Disconnected'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveConnectorTab(tab)}
                        className={`relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          activeConnectorTab === tab
                            ? 'text-white'
                            : 'text-app-textMuted hover:text-white'
                        }`}
                      >
                        {activeConnectorTab === tab && (
                          <motion.div
                            layoutId="activeConnectorTab"
                            className="absolute inset-0 bg-app-surface border border-app-border/50 rounded-md shadow-sm"
                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <span className="relative z-10">{tab}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 flex flex-col min-h-0 mt-4">
                    {/* Table Headers */}
                    <div className="flex items-center px-4 py-2 text-xs font-semibold text-app-textSecondary uppercase tracking-wider mb-2 border-b border-app-border/20">
                      <div className="flex-1">Connector</div>
                      <div className="w-32">Type</div>
                      <div className="w-32">Status</div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      {(() => {
                        const filteredMcpServers = mcpServers.filter(url => {
                          if (activeConnectorTab === 'All') return true;
                          const isConnected = getConnectedMcpUrls().includes(url);
                          if (activeConnectorTab === 'Connected') return isConnected;
                          if (activeConnectorTab === 'Disconnected') return !isConnected;
                          return true;
                        });

                        return (
                          <div className="flex flex-col gap-1">
                            <AnimatePresence mode="popLayout">
                              {filteredMcpServers.length === 0 ? (
                                <motion.div
                                  key={`empty-${activeConnectorTab}`}
                                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                                  transition={{ duration: 0.15 }}
                                  className="flex flex-col items-center justify-center text-app-textMuted py-12 opacity-50"
                                >
                                  <span className="material-symbols-outlined text-[32px] mb-2">cable</span>
                                  <p className="text-sm">{mcpServers.length === 0 ? "No connectors added yet." : "No connectors found."}</p>
                                </motion.div>
                              ) : (
                                filteredMcpServers.map((url) => (
                                  <motion.div 
                                    layout
                                    key={url} 
                                    initial={{ opacity: 0, filter: 'blur(4px)' }}
                                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, filter: 'blur(4px)' }}
                                    transition={{ duration: 0.2 }}
                                    onClick={() => setSelectedConnectorUrl(url)}
                                    className="flex items-center px-4 py-3 bg-[#2a2a28] rounded-xl cursor-pointer hover:bg-[#343432] transition-colors group relative border-b border-app-border/10 last:border-0"
                                  >
                                    {/* Connector Column */}
                                    <div className="flex-1 flex items-center gap-3">
                                      <div className="w-8 h-8 rounded bg-[#1e1e1c] border border-app-border/20 flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-[18px] text-app-textPrimary">cable</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[14px] font-medium text-white">{getMcpName(url)}</span>
                                      </div>
                                    </div>

                                    {/* Type Column */}
                                    <div className="w-32 flex items-center gap-1.5">
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#3e3e3b] text-[#b3b1ad] tracking-wide uppercase">Web</span>
                                      <span className="text-[12px] text-app-textMuted">Custom</span>
                                    </div>

                                    {/* Status Column */}
                                    <div className="w-32 flex items-center justify-between relative">
                                      <div className="flex-1 relative h-7 flex items-center">
                                        <AnimatePresence mode="wait">
                                          {getConnectedMcpUrls().includes(url) ? (
                                            <motion.div
                                              key="connected"
                                              initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
                                              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                                              exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
                                              transition={{ duration: 0.15 }}
                                              className="absolute left-0 flex items-center gap-1.5 text-app-textPrimary"
                                            >
                                              <span className="material-symbols-outlined text-[18px] text-app-textMuted">check</span>
                                            </motion.div>
                                          ) : (
                                            <motion.button 
                                              key="connect-btn"
                                              initial={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
                                              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                                              exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.95 }}
                                              transition={{ duration: 0.15 }}
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const res = await connectMcp(url);
                                                if (res.success) {
                                                    saveMcpConnectionState(url, true);
                                                }
                                                setMcpReloadState(prev => prev + 1);
                                              }}
                                              className="absolute left-0 px-3 py-1 bg-[#161615] hover:bg-[#424240] border border-app-border/30 rounded-lg text-[12px] font-medium text-white transition-colors whitespace-nowrap"
                                            >
                                              Connect
                                            </motion.button>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleRemoveMcp(url); }}
                                        className="text-app-textMuted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-colors p-1"
                                        title="Remove"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                      </button>
                                    </div>
                                  </motion.div>
                                ))
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Add Connector Modal */}
    <AnimatePresence>
      {showAddConnectorModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center font-sans">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-transparent"
            onClick={() => setShowAddConnectorModal(false)}
          />
          
          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto custom-scrollbar bg-[#2a2a28] rounded-xl flex flex-col border border-[#3e3e3b] text-[#E8E5DC] shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[17px] font-semibold text-[#E8E5DC]">Add custom connector</h2>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#3e3e3b] text-[#b3b1ad] tracking-wide">BETA</span>
              </div>
              <button 
                onClick={() => setShowAddConnectorModal(false)}
                className="p-1 rounded-md hover:bg-[#3e3e3b] text-[#b3b1ad] hover:text-[#E8E5DC] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="px-5 pb-5 flex flex-col gap-5">
              <p className="text-[14px] text-[#b3b1ad] leading-relaxed">
                Connect Claude to your data and tools. <a href="#" className="text-[#a4a098] underline hover:text-[#E8E5DC] transition-colors">Learn more about connectors</a> or explore <a href="#" className="text-[#a4a098] underline hover:text-[#E8E5DC] transition-colors">pre-built ones</a>.
              </p>

              <div className="flex flex-col gap-3">
                <input 
                  type="text" 
                  value={mcpInputName}
                  onChange={(e) => setMcpInputName(e.target.value)}
                  placeholder="Name" 
                  className="w-full bg-[#1e1e1d] border border-[#3e3e3b] rounded-lg px-3 py-2 text-[14px] text-[#E8E5DC] placeholder-[#6b6965] focus:outline-none focus:border-[#6b6965] transition-colors"
                />
                <input 
                  type="text" 
                  value={mcpInputUrl}
                  onChange={(e) => setMcpInputUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnectMcp()}
                  placeholder="Remote MCP server URL" 
                  className="w-full bg-[#1e1e1d] border border-[#3e3e3b] rounded-lg px-3 py-2 text-[14px] text-[#E8E5DC] placeholder-[#6b6965] focus:outline-none focus:border-[#6b6965] transition-colors"
                />
              </div>

              {/* Advanced Settings */}
              <div>
                <button 
                  onClick={() => setShowAdvancedConnectorSettings(!showAdvancedConnectorSettings)}
                  className="flex items-center gap-1.5 text-[14px] text-[#b3b1ad] hover:text-[#E8E5DC] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showAdvancedConnectorSettings ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                  </span>
                  Advanced settings
                </button>
                
                <AnimatePresence>
                  {showAdvancedConnectorSettings && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0, marginTop: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0 }}
                      className="overflow-hidden flex flex-col gap-3"
                    >
                      <input 
                        type="text" 
                        placeholder="OAuth Client ID (optional)" 
                        className="w-full bg-[#1e1e1d] border border-[#3e3e3b] rounded-lg px-3 py-2 text-[14px] text-[#E8E5DC] placeholder-[#6b6965] focus:outline-none focus:border-[#6b6965] transition-colors"
                      />
                      <input 
                        type="password" 
                        placeholder="OAuth Client Secret (optional)" 
                        className="w-full bg-[#1e1e1d] border border-[#3e3e3b] rounded-lg px-3 py-2 text-[14px] text-[#E8E5DC] placeholder-[#6b6965] focus:outline-none focus:border-[#6b6965] transition-colors"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer text */}
              <div className="mt-1 text-[13px] text-[#6b6965] leading-relaxed flex flex-col gap-2">
                <p>Only use connectors from developers you trust. Anthropic does not control which tools developers make available and cannot verify that they will work as intended or that they won't change.</p>
                <p>Building an MCP server? <a href="#" className="underline hover:text-[#b3b1ad] transition-colors">Report issues and subscribe to updates here</a></p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-[#3e3e3b] flex items-center justify-end gap-3 bg-[#262624]">
              <button 
                onClick={() => setShowAddConnectorModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#3e3e3b] hover:bg-[#4d4d4b] text-[#E8E5DC] text-[14px] font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConnectMcp}
                className="px-6 py-1.5 bg-[#161615] border border-app-border/20 rounded-lg text-sm font-medium text-app-textPrimary hover:bg-app-surface transition-colors shadow-sm disabled:opacity-50"
                disabled={!mcpInputUrl.trim()}
              >
                Add
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </div>
);
}