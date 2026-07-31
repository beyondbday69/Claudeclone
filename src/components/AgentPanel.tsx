import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit, updateDoc } from 'firebase/firestore';
import Canvas from './Canvas';

interface AgentPanelProps {
  owner?: string;
  repo?: string;
  branch?: string;
  octokit?: Octokit;
}
const VERBS = [
  "Build",
  "Craft",
  "Write",
  "Solve",
  "Draft"
];

const smoothEase = [0.16, 1, 0.3, 1] as const;
const quickSpring = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;
const panelSpring = { type: 'spring', stiffness: 360, damping: 36, mass: 0.9 } as const;

const AnimatedPlaceholder = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % VERBS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center text-[16px] md:text-sm text-app-textMuted font-sans overflow-hidden">
      <div className="relative flex">
        {/* Use a fixed invisible word so the width never changes */}
        <span className="opacity-0 whitespace-pre">Write</span>
        <div className="absolute inset-0 flex">
          <AnimatePresence>
            <motion.div
              key={index}
              className="absolute flex"
              initial="initial"
              animate="enter"
              exit="exit"
            >
              {VERBS[index].split('').map((char, i) => (
                <motion.span
                  key={i}
                  variants={{
                    initial: { y: 20, opacity: 0 },
                    enter: { y: 0, opacity: 1, transition: { duration: 0.34, delay: i * 0.035, ease: smoothEase } },
                    exit: { y: -16, opacity: 0, transition: { duration: 0.22, delay: i * 0.018, ease: smoothEase } }
                  }}
                  style={{ display: 'inline-block', whiteSpace: 'pre' }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <span className="whitespace-pre"> Anything...</span>
    </div>
  );
};

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

const ThinkBlock = ({ content, isActive }: { content: string, isActive?: boolean }) => {
  const [expanded, setExpanded] = useState(isActive ?? false);

  useEffect(() => {
    setExpanded(isActive ?? false);
  }, [isActive]);

  return (
    <div className="my-2">
      <div 
        className="text-[13px] font-sans font-medium text-app-textMuted hover:text-app-textSecondary cursor-pointer flex items-center gap-2 select-none w-fit transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <i className={`ph-fill ph-brain transition-transform duration-200 ${expanded ? 'text-app-textSecondary' : 'text-app-textMuted'} text-[14px] ${isActive ? 'animate-pulse' : ''}`}></i>
        <span className={isActive ? 'animate-shimmer font-semibold' : ''}>Thought process</span>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: smoothEase }}
            className="overflow-hidden"
          >
            <div className="mt-2 ml-[5px] pl-4 border-l-2 border-app-border/40 text-[14px] font-sans text-app-textMuted whitespace-pre-wrap leading-relaxed py-0.5">
              {content.trim()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MessageItem = React.memo(({ msg, viewMode, messages, executePendingTools, handleDeny, ToolGroupViewComponent, running, onOpenCanvas }: any) => {

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
           <div className="bg-app-userBubble/60 border border-app-border/30 px-4 py-3 rounded-xl max-w-[85%] text-sm leading-relaxed text-app-textPrimary/95 whitespace-pre-wrap break-words break-all text-[16px] font-sans">
               {msg.content}
           </div>
        </div>
      );
   }

   if ((!msg.content || msg.content.trim() === '') && (!msg.toolCalls || msg.toolCalls.length === 0)) {
      return null;
   }

   let processedContent = msg.content || '';
   const thinkBlocks: string[] = [];
   processedContent = processedContent.replace(/<think>([\s\S]*?)(?:<\/think>|$)/g, (match, p1) => {
     thinkBlocks.push(p1);
     return '';
   });
   const mergedThinkBlock = thinkBlocks.length > 0 ? thinkBlocks.join('') : null;
   const isThinkingActive = running && msg.id === messages[messages.length - 1]?.id && !processedContent.trim();

   return (
     <div className="text-sm leading-relaxed space-y-5 group">
        <div className="space-y-4">
          {mergedThinkBlock && <ThinkBlock content={mergedThinkBlock} isActive={isThinkingActive} />}
          {processedContent.trim() && (
            viewMode === 'raw' ? (
               <pre className="whitespace-pre-wrap break-words break-all font-mono text-[13px] text-app-textSecondary">
                 {processedContent}
               </pre>
            ) : (
               <div className="markdown-body max-w-none text-[16px] font-sans break-words break-all">
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
                        <CodeBlock match={match} content={content} props={props} onOpenCanvas={onOpenCanvas} />
                      ) : (
                        <code className="bg-[var(--color-app-surfaceHover)] text-[var(--color-app-accent)] px-1.5 py-0.5 rounded-md font-mono text-sm border border-[var(--color-app-borderLight)]" {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {processedContent}
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

const CodeBlock = ({ match, content, props, onOpenCanvas }: { match: any, content: string, props: any, onOpenCanvas?: (content: string, lang: string) => void }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden shadow-sm bg-[#1c1c1e]">
      <div className="px-4 py-2 bg-[#1c1c1e] border-b border-white/10 flex items-center justify-between select-none">
        <span className="text-[13px] font-sans text-[#a8a8a8]">{match[1]}</span>
        <div className="flex items-center gap-2">
          {/* {onOpenCanvas && (
            <button
              onClick={() => onOpenCanvas(content, match[1])}
              className="text-[#a8a8a8] hover:text-white transition-colors flex items-center gap-1.5 text-[12px] font-sans bg-transparent border-none cursor-pointer p-1 rounded"
              title="Open in Canvas"
            >
              <i className="ph-bold ph-arrows-out"></i>
              <span>Canvas</span>
            </button>
          )} */}
          <button 
            onClick={handleCopy}
            className="text-[#a8a8a8] hover:text-white transition-colors flex items-center gap-1.5 text-[12px] font-sans bg-transparent border-none cursor-pointer p-1 rounded"
            title="Copy code"
          >
            {copied ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Copied</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" className="in-aria-busy:text-transparent size-4">
                  <path d="M7 17L7 3L21 3L21 17L7 17Z" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" fill="none"/>
                  <path d="M3 7L3 21L17 21" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinecap="square" data-color="color-2" fill="none"/>
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
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
  );
};

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
  const [reasoningEffort, setReasoningEffort] = useState<string>(() => localStorage.getItem('reasoning_effort') || 'high');
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showAddConnectorModal, setShowAddConnectorModal] = useState(false);
  const [showSystemInstructionsModal, setShowSystemInstructionsModal] = useState(false);
  const [customInstructions, setCustomInstructions] = useState<string>(() => localStorage.getItem('custom_instructions') || '');
  const [activeConnectorTab, setActiveConnectorTab] = useState('All');
  const [showAdvancedConnectorSettings, setShowAdvancedConnectorSettings] = useState(false);
  const [selectedConnectorUrl, setSelectedConnectorUrl] = useState<string | null>(null);
  const [showConnectorTools, setShowConnectorTools] = useState(true);
  const [showGlobalPermissionDropdown, setShowGlobalPermissionDropdown] = useState(false);
  const [showConnectorMenu, setShowConnectorMenu] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [activeCanvas, setActiveCanvas] = useState<{content: string, language: string} | null>(null);

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

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chat_sessions');
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get('session');

    if (saved) {
      try {
        const sessions: ChatSession[] = JSON.parse(saved);
        
        // Priority 1: URL session
        if (urlSession) {
          const session = sessions.find(s => s.id === urlSession);
          if (session) return session.messages;
          return [];
        }

        // Priority 2: Active Job Session
        const activeJobSession = localStorage.getItem('active_job_session');
        if (activeJobSession) {
          const session = sessions.find(s => s.id === activeJobSession);
          if (session) return session.messages;
        }

        // Priority 3: Most recent
        if (sessions.length > 0) return sessions[0].messages;
      } catch (e) {}
    }
    return [];
  });

  const [sessionId, setSessionId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get('session');
    if (urlSession) return urlSession;

    const saved = localStorage.getItem('chat_sessions');
    if (saved) {
      try {
        const sessions: ChatSession[] = JSON.parse(saved);
        const activeJobSession = localStorage.getItem('active_job_session');
        if (activeJobSession) return activeJobSession;
        if (sessions.length > 0) return sessions[0].id;
      } catch (e) {}
    }
    return Date.now().toString();
  });

  // Keep URL in sync with sessionId
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    window.history.replaceState({}, '', url.toString());
  }, [sessionId]);
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('chat_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [sessionsLoaded, setSessionsLoaded] = useState(false);

  useEffect(() => {
    async function loadSessions() {
      const activeJobSession = localStorage.getItem('active_job_session');
      // 1. Fetch from Firebase in background to sync cross-device
      try {
        const q = query(collection(db, 'chat_sessions'), orderBy('updatedAt', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        const loaded: ChatSession[] = [];
        snapshot.forEach(doc => {
          loaded.push(doc.data() as ChatSession);
        });
        
        setSessions(prevLocal => {
          const merged = [...prevLocal];
          loaded.forEach(fbSession => {
            const existingIdx = merged.findIndex(s => s.id === fbSession.id);
            if (existingIdx >= 0) {
              if (fbSession.updatedAt > merged[existingIdx].updatedAt) {
                merged[existingIdx] = fbSession;
              }
            } else {
              merged.push(fbSession);
            }
          });
          merged.sort((a, b) => b.updatedAt - a.updatedAt);
          const resultingSessions = merged.slice(0, 50);
          localStorage.setItem('chat_sessions', JSON.stringify(resultingSessions));
          
          // Re-sync messages for the current session if it was updated from Firebase
          if (activeJobSession) {
             const updatedActive = resultingSessions.find(s => s.id === activeJobSession);
             if (updatedActive && !localStorage.getItem('active_job_id')) { // Don't override if a job is actively appending
                setMessages(updatedActive.messages);
             }
          }

          return resultingSessions;
        });
      } catch (err) {
        console.error("Failed to load sessions from Firebase", err);
      } finally {
        setSessionsLoaded(true);
      }
    }
    loadSessions();
  }, []);

  // Reconnect to an active background job if browser was closed mid-response
  useEffect(() => {
    const activeJobId = localStorage.getItem('active_job_id');
    const activeJobSession = localStorage.getItem('active_job_session');
    const activeJobMsgId = localStorage.getItem('active_job_msg_id');
    
    if (activeJobId && activeJobMsgId) {
      // Check if the job is still running on the server
      fetch(`/api/agent/status/${activeJobId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'running' || data.status === 'done') {
            // Reconnect! Add a placeholder message and start consuming
            setRunning(true);
            const newMsg: Message = {
              id: activeJobMsgId,
              role: 'assistant',
              content: '',
            };
            setMessages(prev => {
              // Only add if not already present
              if (prev.some(m => m.id === activeJobMsgId)) return prev;
              return [...prev, newMsg];
            });
            consumeJobStream(activeJobId, activeJobMsgId, []);
          } else {
            // Job errored or gone, clean up
            localStorage.removeItem('active_job_id');
            localStorage.removeItem('active_job_session');
            localStorage.removeItem('active_job_msg_id');
          }
        })
        .catch(() => {
          localStorage.removeItem('active_job_id');
          localStorage.removeItem('active_job_session');
          localStorage.removeItem('active_job_msg_id');
        });
    }
  }, []);

  const [showSessionsPanel, setShowSessionsPanel] = useState(false);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [activeChatMenu, setActiveChatMenu] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
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
    setMessages([]);
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

  const renameSession = (id: string, newName: string) => {
    if (!newName.trim()) {
      setRenamingChatId(null);
      setActiveChatMenu(null);
      return;
    }
    const newSessions = sessions.map(s => s.id === id ? { ...s, name: newName } : s);
    setSessions(newSessions);
    localStorage.setItem('chat_sessions', JSON.stringify(newSessions));
    updateDoc(doc(db, "chat_sessions", id), { name: newName }).catch(err => {
      console.error("Failed to rename session in Firebase", err);
    });
    setRenamingChatId(null);
    setRenameInput('');
    setActiveChatMenu(null);
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

  const callAgentAPI = async (currentMsgs: Message[], notifyEmail = false) => {
    setRunning(true);
    
    // Format for NVIDIA API
    const apiMessages = [
      { role: 'system', content: getSystemPrompt(owner, repo, currentBranch, agentMode) + (customInstructions ? `\n\nUser Custom Instructions:\n${customInstructions}` : '') },
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
      // Start a background job on the server
      const startRes = await fetch('/api/agent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          provider,
          reasoning_effort: reasoningEffort,
          messages: apiMessages,
          tools: [...getTools(agentMode, !!(owner && repo), webSearchEnabled), ...getActiveMcpTools()],
          notifyEmail,
        })
      });

      if (!startRes.ok) {
        let errorDetails = '';
        try {
          const errData = await startRes.json();
          errorDetails = errData.error?.message || errData.error || errData.message || JSON.stringify(errData);
        } catch {
          errorDetails = await startRes.text();
        }
        throw new Error(errorDetails || startRes.statusText);
      }

      const { jobId } = await startRes.json();
      
      // Save jobId so we can reconnect if browser closes
      localStorage.setItem('active_job_id', jobId);
      localStorage.setItem('active_job_session', sessionId);

      const newMsgId = Date.now().toString() + Math.random().toString();
      localStorage.setItem('active_job_msg_id', newMsgId);
      const newMsg: Message = {
        id: newMsgId,
        role: 'assistant',
        content: '',
      };
      
      setMessages(prev => [...prev, newMsg]);

      // Connect to the SSE stream
      await consumeJobStream(jobId, newMsgId, currentMsgs);

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + Math.random().toString(),
        role: 'system',
        content: err.message
      }]);
      setRunning(false);
      localStorage.removeItem('active_job_id');
      localStorage.removeItem('active_job_session');
      localStorage.removeItem('active_job_msg_id');
    }
  };

  const consumeJobStream = async (jobId: string, newMsgId: string, currentMsgs: Message[]) => {
    try {
      const response = await fetch(`/api/agent/stream/${jobId}`);
      
      if (!response.ok) {
        throw new Error('Failed to connect to job stream');
      }
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

              // Handle rate limit countdown
              if (data.rateLimit) {
                if (data.countdown !== undefined) {
                  setRateLimitCountdown(data.countdown);
                  if (data.countdown === 0) {
                    setRateLimitCountdown(null);
                  }
                } else if (data.waitSeconds) {
                  setRateLimitCountdown(data.waitSeconds);
                  setMessages(prev => prev.map(m => m.id === newMsgId ? { ...m, content: `⏳ Rate limited by NVIDIA. Retrying in ${data.waitSeconds}s... (attempt ${data.attempt}/${data.maxRetries})` } : m));
                }
                continue;
              }

              // Check for server-side error
              if (data.error) {
                throw new Error(data.error);
              }
              
              const delta = data.choices[0]?.delta;
              
              if (delta) {
                let textToAppend = '';
                
                if (typeof delta.reasoning === 'string' && delta.reasoning) {
                  // If reasoning is a separate string field
                  textToAppend += `<think>${delta.reasoning}</think>\n\n`;
                }
                
                if (typeof delta.content === 'string') {
                  textToAppend += delta.content;
                } else if (Array.isArray(delta.content)) {
                  for (const item of delta.content) {
                    if (item.text) textToAppend += item.text;
                    if (item.type === 'reasoning' && item.reasoning) textToAppend += `<think>${item.reasoning}</think>\n\n`;
                    if (item.type === 'thinking') {
                      const tc = typeof item.thinking === 'string' ? item.thinking : (Array.isArray(item.thinking) ? item.thinking.map((t: any) => t.text).join('') : '');
                      if (tc) textToAppend += `<think>${tc}</think>\n\n`;
                    }
                  }
                } else if (typeof delta.content === 'object' && delta.content !== null) {
                  const contentObj = delta.content as any;
                  if (contentObj.text) textToAppend += contentObj.text;
                  if (contentObj.reasoning) textToAppend += `<think>${contentObj.reasoning}</think>\n\n`;
                  if (contentObj.type === 'thinking' || contentObj.thinking) {
                    const tc = typeof contentObj.thinking === 'string' ? contentObj.thinking : (Array.isArray(contentObj.thinking) ? contentObj.thinking.map((t: any) => t.text).join('') : '');
                    if (tc) textToAppend += `<think>${tc}</think>\n\n`;
                  }
                }

                if (textToAppend) {
                  fullContent += textToAppend;
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
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) throw e;
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
      
      const syncNextMsgs = [...currentMsgs, {
        id: newMsgId,
        role: 'assistant' as const,
        content: fullContent,
        ...(finalToolCalls ? { toolCalls: finalToolCalls } : {}),
        ...(hasAsk ? { isApprovalPending: true } : {})
      }];

      const updatedMsg = syncNextMsgs.find(m => m.id === newMsgId);
      
      // Clean up job tracking
      localStorage.removeItem('active_job_id');
      localStorage.removeItem('active_job_session');
      localStorage.removeItem('active_job_msg_id');

      if (updatedMsg?.toolCalls && !updatedMsg.isApprovalPending) {
         setTimeout(() => executePendingTools(updatedMsg, syncNextMsgs), 0);
      } else if (!updatedMsg?.toolCalls) {
         setRunning(false);
      }

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString() + Math.random().toString(),
        role: 'system',
        content: err.message
      }]);
      setRunning(false);
      localStorage.removeItem('active_job_id');
      localStorage.removeItem('active_job_session');
      localStorage.removeItem('active_job_msg_id');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || running) return;

    let task = input.trim();
    let notifyEmail = false;

    if (task.startsWith('/task ')) {
      notifyEmail = true;
      task = task.slice(6).trim();
    } else if (task === '/task') {
      notifyEmail = true;
      task = "Please complete the pending task."; // default prompt if they just type /task
    }

    setInput('');
    const textarea = document.querySelector('textarea');
    if (textarea) textarea.style.height = 'auto';
    scrollToBottom(true);
    setShowMentions(false);
    
    const newMsgs = [...messages, { id: Date.now().toString() + Math.random().toString(), role: 'user' as const, content: task }];
    setMessages(newMsgs);
    callAgentAPI(newMsgs, notifyEmail);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    
    setInput(val);
    
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'; // Max 32rem / 128px

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

  const filteredMentionItems = useMemo(() => {
    const filter = mentionFilter.toLowerCase();
    const items: { name: string; category: 'file' | 'tool' | 'mcp'; description?: string }[] = [];

    // Files
    files.filter(f => f.toLowerCase().includes(filter)).slice(0, 5).forEach(f => {
      items.push({ name: f, category: 'file' });
    });

    // Built-in tools
    const builtInTools = getTools(agentMode, !!(owner && repo), webSearchEnabled);
    builtInTools.filter(t => t.function.name.toLowerCase().includes(filter)).slice(0, 5).forEach(t => {
      items.push({ name: t.function.name, category: 'tool', description: t.function.description });
    });

    // MCP tools
    const mcpTools = getActiveMcpTools();
    mcpTools.filter((t: any) => t.function.name.toLowerCase().includes(filter)).slice(0, 5).forEach((t: any) => {
      items.push({ name: t.function.name, category: 'mcp', description: t.function.description });
    });

    return items.slice(0, 12);
  }, [mentionFilter, files, agentMode, owner, repo, webSearchEnabled]);

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
    if (showMentions && filteredMentionItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMentionItems.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMentionItems.length) % filteredMentionItems.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentionItems[mentionIndex].name);
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
      transition={panelSpring}
      className={`h-full bg-[#17161B] border-r border-[var(--color-app-border)] shrink-0 flex flex-col z-50 absolute md:relative left-0 top-0 overflow-hidden shadow-2xl md:shadow-none ${!showSessionsPanel ? 'max-md:hidden' : ''}`}
    >
      <div className="flex flex-col h-full min-w-[260px] w-[260px]">
        {/* Toggle Button Area */}
        <div className="flex items-center pt-3 pb-2 shrink-0">
           <div className="w-[56px] flex items-center justify-center shrink-0">
             <button onClick={() => setShowSessionsPanel(!showSessionsPanel)} className="bg-gradient-to-br from-[#FF6A00] to-[#cc3a05] text-white hover:opacity-90 transition-premium p-1.5 rounded-lg flex items-center justify-center shadow-md">
                <svg viewBox="0 0 397.46 281.64" className="w-[19px] h-[19px]" fill="currentColor">
                  <path d="M340.814 84.181 C 340.814 99.640,340.848 105.964,340.890 98.234 C 340.932 90.505,340.932 77.857,340.890 70.127 C 340.848 62.398,340.814 68.722,340.814 84.181 M170.339 112.147 C 170.069 112.321,149.330 112.422,113.206 112.425 L 56.497 112.429 56.497 140.494 L 56.497 168.558 106.285 168.691 C 157.316 168.827,261.045 168.838,312.147 168.714 L 340.819 168.644 340.746 140.537 L 340.673 112.429 283.771 112.429 C 246.141 112.429,226.810 112.334,226.695 112.147 C 226.459 111.765,170.929 111.765,170.339 112.147 " />
                  <path d="M340.814 140.395 C 340.814 155.855,340.848 162.179,340.890 154.449 C 340.932 146.720,340.932 134.071,340.890 126.342 C 340.848 118.612,340.814 124.936,340.814 140.395 M56.566 196.679 L 56.638 224.718 84.605 224.795 C 99.986 224.838,112.857 224.803,113.208 224.719 L 113.845 224.565 113.773 196.675 L 113.701 168.785 85.097 168.713 L 56.494 168.641 56.566 196.679 M169.962 168.832 C 169.555 169.240,169.748 224.485,170.158 224.826 C 170.438 225.058,178.144 225.125,198.759 225.072 L 226.977 225.000 227.049 196.822 L 227.121 168.644 198.636 168.644 C 182.969 168.644,170.066 168.729,169.962 168.832 M283.464 168.997 C 283.389 169.191,283.362 181.808,283.402 197.034 L 283.475 224.718 312.006 224.718 L 340.537 224.718 340.678 196.681 L 340.819 168.644 312.209 168.644 C 289.580 168.644,283.570 168.718,283.464 168.997 " />
                  <path d="M340.814 27.966 C 340.814 43.425,340.848 49.749,340.890 42.020 C 340.932 34.290,340.932 21.642,340.890 13.912 C 340.848 6.183,340.814 12.507,340.814 27.966 M113.702 55.930 C 113.586 56.118,103.890 56.215,85.012 56.215 L 56.497 56.215 56.497 84.322 L 56.497 112.429 113.112 112.429 C 144.251 112.429,169.929 112.352,170.175 112.258 C 170.630 112.083,170.900 57.271,170.452 56.102 C 170.246 55.566,114.032 55.396,113.702 55.930 M226.869 56.033 C 226.637 56.314,226.570 63.946,226.623 84.353 L 226.695 112.288 283.757 112.359 L 340.819 112.431 340.746 84.323 L 340.673 56.215 312.161 56.215 C 293.458 56.215,283.589 56.118,283.475 55.932 C 283.178 55.452,227.269 55.552,226.869 56.033 " />
                  <path d="M56.497 28.109 L 56.497 56.217 85.099 56.145 L 113.701 56.073 113.773 28.037 L 113.845 0.000 85.171 0.000 L 56.497 0.000 56.497 28.109 M283.403 28.037 L 283.475 56.073 312.147 56.145 L 340.819 56.217 340.746 28.109 L 340.673 0.000 312.002 -0.000 L 283.331 -0.000 283.403 28.037 M226.407 84.181 C 226.407 99.484,226.441 105.745,226.483 98.093 C 226.525 90.441,226.525 77.920,226.483 70.268 C 226.441 62.617,226.407 68.877,226.407 84.181 " />
                  <path d="M340.677 196.751 L 340.537 224.718 284.084 224.613 C 238.408 224.529,227.501 224.578,226.951 224.873 L 226.271 225.237 226.271 253.099 C 226.271 274.392,226.351 281.040,226.610 281.299 C 226.872 281.562,246.271 281.638,312.203 281.638 L 397.458 281.638 397.458 253.107 L 397.458 224.576 369.210 224.576 L 340.963 224.576 340.891 196.681 L 340.818 168.785 340.677 196.751 M0.000 253.155 L 0.000 281.639 85.240 281.568 L 170.480 281.497 170.552 253.420 C 170.599 235.209,170.526 225.225,170.345 225.007 C 170.129 224.748,150.516 224.670,85.033 224.670 L 0.000 224.670 0.000 253.155 " />
                </svg>
             </button>
           </div>
           <span className={`text-[16px] font-sans font-medium tracking-[-0.5px] leading-none text-app-textPrimary whitespace-nowrap transition-opacity duration-150 ${showSessionsPanel ? 'opacity-100' : 'opacity-0'}`}>
             Vibe
           </span>
        </div>
        
        {/* Action Buttons Area */}
        <div className="mt-[1vh] pb-3 border-b border-[var(--color-app-borderLight)] shrink-0 flex flex-col gap-1">
           <button 
             onClick={createNewSession}
             className="flex items-center w-full rounded-lg hover:bg-app-surface text-app-textPrimary transition-premium overflow-hidden group"
             title="New Chat"
           >
             <div className="w-[56px] h-[36px] flex items-center justify-center shrink-0 group-hover:text-white">
               <div className="w-[28px] h-[28px] bg-[#29282D] rounded-lg flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 24 24" className="shrink-0 text-[#faf9f5]" strokeWidth={1.75}><path d="M3 12H21" stroke="currentColor" strokeWidth={2} strokeMiterlimit={10} strokeLinecap="square" data-color="color-2" fill="none"/><path d="M12 3V21" stroke="currentColor" strokeWidth={2} strokeMiterlimit={10} strokeLinecap="square" fill="none"/></svg>
               </div>
             </div>
             <span className={`text-[#faf9f5] text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${showSessionsPanel ? 'opacity-100' : 'opacity-0'}`}>
               New chat
             </span>
           </button>

           <div className="w-full flex flex-col">
             <button 
               onClick={() => setShowContextMenu(!showContextMenu)}
               className="flex items-center w-full rounded-lg hover:bg-[var(--color-app-surface)] text-app-textPrimary transition-premium overflow-hidden group"
               title="Context"
             >
               <div className="w-[56px] h-[36px] flex items-center justify-center shrink-0 group-hover:text-white">
                 <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" className="shrink-0 text-[#faf9f5] size-[18px]">
                   <path d="M10 3L10 10L3 10L3 3L10 3Z" stroke="currentColor" strokeWidth={2} strokeMiterlimit={10} strokeLinecap="square" data-color="color-2" fill="none"/>
                   <path d="M21 14L21 21L14 21L14 14L21 14Z" stroke="currentColor" strokeWidth={2} strokeMiterlimit={10} strokeLinecap="square" data-color="color-2" fill="none"/>
                   <path d="M6.5 21C8.433 21 10 19.433 10 17.5C10 15.567 8.433 14 6.5 14C4.567 14 3 15.567 3 17.5C3 19.433 4.567 21 6.5 21Z" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                   <path d="M21 6.5L14 6.5" stroke="currentColor" strokeWidth={2} strokeMiterlimit={10} strokeLinecap="square" fill="none"/>
                   <path d="M17.495 3C17.495 5.34315 17.495 7.65685 17.495 10" stroke="currentColor" strokeWidth={2} strokeMiterlimit={10} strokeLinecap="square" fill="none"/>
                 </svg>
               </div>
               <span className={`text-[#faf9f5] text-sm font-medium whitespace-nowrap transition-opacity duration-150 ${showSessionsPanel ? 'opacity-100' : 'opacity-0'}`}>
                 Context
               </span>
             </button>

             <AnimatePresence>
               {showContextMenu && (
                 <motion.div
                   initial={{ height: 0, opacity: 0 }}
                   animate={{ height: 'auto', opacity: 1 }}
                   exit={{ height: 0, opacity: 0 }}
                   className="overflow-hidden w-full"
                 >
                   <div className="relative flex flex-col pl-[28px] pr-2 py-1 mt-1 gap-1">
                     {/* Vertical connecting line */}
                     <div className="absolute left-[27px] top-0 bottom-5 w-[2px] bg-[var(--color-app-borderLight)] rounded-full"></div>
                     
                     <div className="pl-4 relative">
                       {/* Horizontal connecting line */}
                       <div className="absolute left-0 top-[17px] w-3 h-[2px] bg-[var(--color-app-borderLight)] rounded-full"></div>
                       <button
                         onClick={() => setShowAddConnectorModal(true)}
                         className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-app-textSecondary hover:text-app-textPrimary hover:bg-[var(--color-app-surfaceHover)] rounded-lg text-left transition-colors"
                       >
                         Connectors
                       </button>
                     </div>

                     <div className="pl-4 relative">
                       {/* Horizontal connecting line */}
                       <div className="absolute left-0 top-[17px] w-3 h-[2px] bg-[var(--color-app-borderLight)] rounded-full"></div>
                       <button
                         onClick={() => {
                           setShowContextMenu(false);
                           setShowSystemInstructionsModal(true);
                         }}
                         className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-app-textSecondary hover:text-app-textPrimary hover:bg-[var(--color-app-surfaceHover)] rounded-lg text-left transition-colors"
                       >
                         System Instructions
                       </button>
                     </div>
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
        </div>
        
        {/* Chat List */}
        <div className={`p-3 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-0 transition-opacity duration-150 ${showSessionsPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="px-2 pt-2 pb-1 text-xs font-semibold text-[#a09d96] whitespace-nowrap">
            Recents
          </div>
          
          {sessions.length === 0 ? (
            <div className="text-center text-app-textMuted text-xs py-8">No saved chats yet.</div>
          ) : (
            sessions.map(s => (
              <div 
                key={s.id} 
                className={`relative flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-premium cursor-pointer group ${s.id === sessionId ? 'text-app-textPrimary bg-transparent' : 'text-app-textSecondary hover:bg-[var(--color-app-surfaceHover)]'}`}
                onClick={() => loadSession(s.id)}
              >
                {renamingChatId === s.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    onBlur={() => renameSession(s.id, renameInput)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameSession(s.id, renameInput);
                      if (e.key === 'Escape') { setRenamingChatId(null); setActiveChatMenu(null); }
                    }}
                    className="flex-1 bg-black/20 text-sm text-app-textPrimary px-2 py-1 rounded border border-app-border focus:outline-none focus:border-app-accent mr-2"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="text-sm font-medium truncate flex-1 pr-2">{s.name}</div>
                )}
                
                <div className="relative flex-shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveChatMenu(activeChatMenu === s.id ? null : s.id);
                    }}
                    className={`text-app-textMuted hover:text-white p-1 rounded flex items-center justify-center ${activeChatMenu === s.id ? 'text-white' : ''}`}
                    title="Options"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" className="size-4"><path d="M12 12H12.01" stroke="currentColor" strokeWidth="3" strokeLinecap="square" data-color="color-2" fill="none"/><path d="M12 5H12.01" stroke="currentColor" strokeWidth="3" strokeLinecap="square" fill="none"/><path d="M12 19H12.01" stroke="currentColor" strokeWidth="3" strokeLinecap="square" fill="none"/></svg>
                  </button>
                  
                  {activeChatMenu === s.id && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-[#17161B] border border-[var(--color-app-borderLight)] rounded-lg shadow-xl z-50 overflow-hidden py-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingChatId(s.id);
                          setRenameInput(s.name);
                          setActiveChatMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-app-textPrimary hover:bg-[var(--color-app-surfaceHover)] flex items-center gap-2"
                      >
                        <i className="ph-light ph-pencil"></i> Rename
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(s.id, e);
                          setActiveChatMenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"
                      >
                        <i className="ph-light ph-trash"></i> Delete
                      </button>
                    </div>
                  )}
                </div>
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
              className="md:hidden bg-gradient-to-br from-[#FF6A00] to-[#cc3a05] text-white hover:opacity-90 transition-premium flex items-center justify-center p-1.5 rounded-lg shadow-md" 
              onClick={() => setShowSessionsPanel(true)}
              title="Open Sidebar"
            >
                <svg viewBox="0 0 397.46 281.64" className="w-[19px] h-[19px]" fill="currentColor">
                  <path d="M340.814 84.181 C 340.814 99.640,340.848 105.964,340.890 98.234 C 340.932 90.505,340.932 77.857,340.890 70.127 C 340.848 62.398,340.814 68.722,340.814 84.181 M170.339 112.147 C 170.069 112.321,149.330 112.422,113.206 112.425 L 56.497 112.429 56.497 140.494 L 56.497 168.558 106.285 168.691 C 157.316 168.827,261.045 168.838,312.147 168.714 L 340.819 168.644 340.746 140.537 L 340.673 112.429 283.771 112.429 C 246.141 112.429,226.810 112.334,226.695 112.147 C 226.459 111.765,170.929 111.765,170.339 112.147 " />
                  <path d="M340.814 140.395 C 340.814 155.855,340.848 162.179,340.890 154.449 C 340.932 146.720,340.932 134.071,340.890 126.342 C 340.848 118.612,340.814 124.936,340.814 140.395 M56.566 196.679 L 56.638 224.718 84.605 224.795 C 99.986 224.838,112.857 224.803,113.208 224.719 L 113.845 224.565 113.773 196.675 L 113.701 168.785 85.097 168.713 L 56.494 168.641 56.566 196.679 M169.962 168.832 C 169.555 169.240,169.748 224.485,170.158 224.826 C 170.438 225.058,178.144 225.125,198.759 225.072 L 226.977 225.000 227.049 196.822 L 227.121 168.644 198.636 168.644 C 182.969 168.644,170.066 168.729,169.962 168.832 M283.464 168.997 C 283.389 169.191,283.362 181.808,283.402 197.034 L 283.475 224.718 312.006 224.718 L 340.537 224.718 340.678 196.681 L 340.819 168.644 312.209 168.644 C 289.580 168.644,283.570 168.718,283.464 168.997 " />
                  <path d="M340.814 27.966 C 340.814 43.425,340.848 49.749,340.890 42.020 C 340.932 34.290,340.932 21.642,340.890 13.912 C 340.848 6.183,340.814 12.507,340.814 27.966 M113.702 55.930 C 113.586 56.118,103.890 56.215,85.012 56.215 L 56.497 56.215 56.497 84.322 L 56.497 112.429 113.112 112.429 C 144.251 112.429,169.929 112.352,170.175 112.258 C 170.630 112.083,170.900 57.271,170.452 56.102 C 170.246 55.566,114.032 55.396,113.702 55.930 M226.869 56.033 C 226.637 56.314,226.570 63.946,226.623 84.353 L 226.695 112.288 283.757 112.359 L 340.819 112.431 340.746 84.323 L 340.673 56.215 312.161 56.215 C 293.458 56.215,283.589 56.118,283.475 55.932 C 283.178 55.452,227.269 55.552,226.869 56.033 " />
                  <path d="M56.497 28.109 L 56.497 56.217 85.099 56.145 L 113.701 56.073 113.773 28.037 L 113.845 0.000 85.171 0.000 L 56.497 0.000 56.497 28.109 M283.403 28.037 L 283.475 56.073 312.147 56.145 L 340.819 56.217 340.746 28.109 L 340.673 0.000 312.002 -0.000 L 283.331 -0.000 283.403 28.037 M226.407 84.181 C 226.407 99.484,226.441 105.745,226.483 98.093 C 226.525 90.441,226.525 77.920,226.483 70.268 C 226.441 62.617,226.407 68.877,226.407 84.181 " />
                  <path d="M340.677 196.751 L 340.537 224.718 284.084 224.613 C 238.408 224.529,227.501 224.578,226.951 224.873 L 226.271 225.237 226.271 253.099 C 226.271 274.392,226.351 281.040,226.610 281.299 C 226.872 281.562,246.271 281.638,312.203 281.638 L 397.458 281.638 397.458 253.107 L 397.458 224.576 369.210 224.576 L 340.963 224.576 340.891 196.681 L 340.818 168.785 340.677 196.751 M0.000 253.155 L 0.000 281.639 85.240 281.568 L 170.480 281.497 170.552 253.420 C 170.599 235.209,170.526 225.225,170.345 225.007 C 170.129 224.748,150.516 224.670,85.033 224.670 L 0.000 224.670 0.000 253.155 " />
                </svg>
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
                className="bg-transparent font-medium outline-none cursor-pointer max-w-[150px] truncate pr-4 flex items-center gap-1 select-none"
                onClick={() => { setModelDropdownOpen(!modelDropdownOpen); setProviderDropdownOpen(false); }}
              >
                {provider === 'mistral' && model.startsWith('ag_') ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold tracking-wide bg-emerald-400/10 px-2 py-0.5 rounded shadow-sm border border-emerald-400/30">
                    <i className="ph-fill ph-robot text-sm"></i>
                    Agent Mode
                  </span>
                ) : (
                  model.split('/').pop()
                )}
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
                    {provider === 'mistral' && (
                      <div className="px-3 py-2 border-t border-app-border/30 mt-1">
                        <input 
                          type="text" 
                          placeholder="Paste custom ag_... ID & Enter"
                          className="w-full bg-black/20 border border-app-border/50 rounded px-2 py-1.5 text-[11px] text-app-textPrimary outline-none focus:border-emerald-400/50 transition-colors placeholder:text-app-textMuted"
                          onClick={e => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                              const newModel = e.currentTarget.value.trim();
                              setModel(newModel);
                              localStorage.setItem('selected_model', newModel);
                              setModelDropdownOpen(false);
                            }
                          }}
                        />
                      </div>
                    )}
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
                 running={running}
                 onOpenCanvas={(content: string, language: string) => setActiveCanvas({ content, language })}
               />
             ));
          })()}
          
          {running && (
             <div className="flex items-center gap-2 text-xs">
                 <span className="animate-shimmer font-medium">Mistral is thinking...</span>
             </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky Input Area */}
      <motion.div 
        initial={false}
        animate={{
          bottom: messages.length === 0 ? "50%" : "0px",
          y: messages.length === 0 ? "50%" : "0px",
          paddingBottom: messages.length === 0 ? "0px" : "24px",
          paddingTop: messages.length === 0 ? "0px" : "48px",
        }}
        transition={{ duration: 0.45, ease: smoothEase }}
        className={`absolute left-0 right-0 px-4 md:px-0 pointer-events-none z-10 ${messages.length > 0 ? 'bg-gradient-to-t from-app-main via-app-main/95 to-transparent' : ''}`}
      >
        <div className="max-w-2xl mx-auto pointer-events-auto flex flex-col items-start w-full">
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28, ease: smoothEase }}
                className="flex flex-col items-start mb-8 text-left w-full"
              >
                <svg className="w-14 h-14 mb-4 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212.121 151.515" shapeRendering="crispEdges">
                  <rect x="30.303001" y="0" width="30.302999" height="30.302999" fill="#FFAF01"/>
                  <rect x="151.515" y="0" width="30.302999" height="30.302999" fill="#FFAF01"/>
                  <rect x="30.303001" y="30.303001" width="60.605999" height="30.302999" fill="#FF8204"/>
                  <rect x="121.21201" y="30.303001" width="60.605999" height="30.302999" fill="#FF8204"/>
                  <rect x="30.303001" y="60.606003" width="151.515" height="30.302999" fill="#FA500F"/>
                  <rect x="30.303001" y="90.908997" width="30.302999" height="30.302999" fill="#E51300"/>
                  <rect x="90.908997" y="90.908997" width="30.302999" height="30.302999" fill="#E51300"/>
                  <rect x="151.515" y="90.908997" width="30.302999" height="30.302999" fill="#E51300"/>
                  <rect x="0" y="121.21201" width="90.908997" height="30.302999" fill="#C4001D"/>
                  <rect x="121.21201" y="121.21201" width="90.908997" height="30.302999" fill="#C4001D"/>
                </svg>
                <h1 className="text-4xl font-semibold text-white tracking-tight flex items-center justify-start drop-shadow-md">
                  Welcome, Swapnil
                </h1>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="w-full relative">
            {showMentions && filteredMentionItems.length > 0 && (
            <div className="mb-2 w-full max-h-60 overflow-y-auto bg-[#27262B] backdrop-blur-md border border-app-border/40 rounded-xl shadow-xl z-50 custom-scrollbar">
              {filteredMentionItems.map((item, i) => (
                <div 
                  key={`${item.category}-${item.name}`} 
                  className={`px-3 py-2 cursor-pointer transition-premium flex items-center gap-2.5 ${i === mentionIndex ? 'bg-app-surfaceHover text-app-textPrimary' : 'text-app-textSecondary hover:bg-app-surface/50'}`}
                  onClick={() => insertMention(item.name)}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    item.category === 'tool' ? 'bg-app-accent/20 text-app-accent' :
                    item.category === 'mcp' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {item.category === 'tool' ? <i className="ph-light ph-wrench text-xs" /> :
                     item.category === 'mcp' ? <i className="ph-light ph-plug text-xs" /> :
                     <i className="ph-light ph-file text-xs" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.name}</div>
                    {item.description && <div className="text-[10px] text-app-textMuted truncate">{item.description}</div>}
                  </div>
                  <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                    item.category === 'tool' ? 'bg-app-accent/10 text-app-accent' :
                    item.category === 'mcp' ? 'bg-purple-500/10 text-purple-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    {item.category === 'mcp' ? 'MCP' : item.category === 'tool' ? 'Tool' : 'File'}
                  </span>
                </div>
              ))}
            </div>
          )}
          
          <div className="bg-[#27262B] backdrop-blur-md border border-app-border/40 rounded-xl shadow-xl flex items-end gap-2 px-2.5 py-2 focus-within:ring-1 focus-within:ring-app-border/80 focus-within:border-transparent transition-premium">
            <div className="relative">
              <button 
                  onClick={() => { setShowPlusMenu(!showPlusMenu); setActiveSubmenu(null); }}
                  disabled={running}
                  title="Add attachment or options"
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-app-surface/60 hover:bg-app-surface border border-app-border/40 text-app-textMuted hover:text-app-textSecondary rounded-lg transition-premium relative z-50"
              >
                  <i className={`ph-light ph-plus text-md transition-transform duration-200 ${showPlusMenu ? 'rotate-45' : ''}`}></i>
              </button>
              
              <AnimatePresence>
                {showPlusMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => { setShowPlusMenu(false); setActiveSubmenu(null); }} />
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: messages.length === 0 ? -10 : 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: messages.length === 0 ? -10 : 10, scale: 0.95 }}
                      transition={{ ...quickSpring, layout: { duration: 0.24, ease: smoothEase } }}
                      className={`absolute left-0 w-48 bg-[#27262B] backdrop-blur-md border border-app-border/40 rounded-xl shadow-2xl z-50 overflow-hidden ${messages.length === 0 ? 'top-full mt-3' : 'bottom-full mb-3'}`}
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        {activeSubmenu === null && (
                          <motion.div
                            key="main"
                            initial={{ opacity: 0, x: -10, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transition: { delay: 0.08, duration: 0.22, ease: smoothEase } }}
                            exit={{ opacity: 0, x: -8, filter: 'blur(4px)', transition: { duration: 0.16, ease: smoothEase } }}
                            className="flex flex-col p-1.5 w-full"
                          >
                            <button onClick={() => setActiveSubmenu('provider')} className="flex items-center justify-between px-2.5 py-2 text-xs rounded-lg hover:bg-app-surface/50 transition-premium text-app-textPrimary w-full text-left">
                              <div className="flex items-center gap-2">
                                <i className="ph-light ph-cpu text-app-textMuted text-sm"></i>
                                <span className="font-medium">Provider</span>
                              </div>
                              <div className="flex items-center gap-1 text-app-textMuted">
                                <span className="capitalize">{provider}</span>
                                <i className="ph-light ph-caret-right"></i>
                              </div>
                            </button>
                            
                            <button onClick={() => setActiveSubmenu('reasoning')} className="flex items-center justify-between px-2.5 py-2 text-xs rounded-lg hover:bg-app-surface/50 transition-premium text-app-textPrimary w-full text-left mt-0.5">
                              <div className="flex items-center gap-2">
                                <i className="ph-light ph-brain text-app-textMuted text-sm"></i>
                                <span className="font-medium">Reasoning</span>
                              </div>
                              <div className="flex items-center gap-1 text-app-textMuted">
                                <span className="capitalize">{reasoningEffort}</span>
                                <i className="ph-light ph-caret-right"></i>
                              </div>
                            </button>
                            
                            <div className="h-px bg-app-border/20 my-1.5 mx-2"></div>
                            
                            <button 
                              onClick={() => {
                                setWebSearchEnabled(!webSearchEnabled);
                                setShowPlusMenu(false);
                              }}
                              className="flex items-center justify-between px-2.5 py-2 text-xs rounded-lg hover:bg-app-surface/50 transition-premium text-app-textPrimary w-full text-left group"
                            >
                              <div className="flex items-center gap-2">
                                <i className="ph-light ph-globe text-app-textMuted text-sm"></i>
                                <span className="font-medium">Web Search</span>
                              </div>
                              <div className={`w-7 h-4 rounded-full flex items-center p-0.5 transition-colors duration-300 ${webSearchEnabled ? 'bg-[#1A191E]' : 'bg-[#3e3e3b]'}`}>
                                 <div className={`w-3 h-3 rounded-full shadow-sm transition-transform duration-300 ${webSearchEnabled ? 'bg-white translate-x-3' : 'bg-white translate-x-0'}`}></div>
                              </div>
                            </button>
                          </motion.div>
                        )}
                        
                        {activeSubmenu === 'provider' && (
                          <motion.div
                            key="provider"
                            initial={{ opacity: 0, x: 10, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transition: { delay: 0.08, duration: 0.22, ease: smoothEase } }}
                            exit={{ opacity: 0, x: 8, filter: 'blur(4px)', transition: { duration: 0.16, ease: smoothEase } }}
                            className="flex flex-col p-1.5 w-full"
                          >
                            <button onClick={() => setActiveSubmenu(null)} className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg hover:bg-app-surface/50 transition-premium text-app-textSecondary hover:text-app-textPrimary w-full text-left mb-1">
                              <i className="ph-light ph-caret-left"></i>
                              <span className="font-medium">Back</span>
                            </button>
                            {[
                              { id: 'opencode', name: 'OpenCode' },
                              { id: 'nvidia', name: 'NVIDIA' },
                              { id: 'openrouter', name: 'OpenRouter' },
                              { id: 'mistral', name: 'Mistral' }
                            ].map(p => (
                              <button 
                                key={p.id}
                                onClick={() => {
                                  setProvider(p.id);
                                  localStorage.setItem('selected_provider', p.id);
                                  setActiveSubmenu(null);
                                  setShowPlusMenu(false);
                                }}
                                className={`flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-premium w-full text-left ${provider === p.id ? 'bg-app-surface/60 text-app-textPrimary' : 'hover:bg-app-surface/30 text-app-textSecondary hover:text-app-textPrimary'}`}
                              >
                                <span className="font-medium">{p.name}</span>
                                {provider === p.id && <i className="ph-fill ph-check-circle text-app-accent"></i>}
                              </button>
                            ))}
                          </motion.div>
                        )}
                        
                        {activeSubmenu === 'reasoning' && (
                          <motion.div
                            key="reasoning"
                            initial={{ opacity: 0, x: 10, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)', transition: { delay: 0.08, duration: 0.22, ease: smoothEase } }}
                            exit={{ opacity: 0, x: 8, filter: 'blur(4px)', transition: { duration: 0.16, ease: smoothEase } }}
                            className="flex flex-col p-1.5 w-full"
                          >
                            <button onClick={() => setActiveSubmenu(null)} className="flex items-center gap-2 px-2.5 py-2 text-xs rounded-lg hover:bg-app-surface/50 transition-premium text-app-textSecondary hover:text-app-textPrimary w-full text-left mb-1">
                              <i className="ph-light ph-caret-left"></i>
                              <span className="font-medium">Back</span>
                            </button>
                            {[
                              { id: 'high', name: 'High', color: 'text-emerald-400' },
                              { id: 'medium', name: 'Medium', color: 'text-yellow-400' },
                              { id: 'low', name: 'Low', color: 'text-white' },
                              { id: 'none', name: 'None', color: 'text-app-textSecondary' }
                            ].map(e => (
                              <button 
                                key={e.id}
                                onClick={() => {
                                  setReasoningEffort(e.id);
                                  localStorage.setItem('reasoning_effort', e.id);
                                  setActiveSubmenu(null);
                                  setShowPlusMenu(false);
                                }}
                                className={`flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-premium w-full text-left ${reasoningEffort === e.id ? `bg-app-surface/60 ${e.color}` : 'hover:bg-app-surface/30 text-app-textSecondary hover:text-app-textPrimary'}`}
                              >
                                <span className="font-medium">{e.name}</span>
                                {reasoningEffort === e.id && <i className={`ph-fill ph-check-circle ${e.color}`}></i>}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 relative flex flex-col min-w-0">
              {(!input && !running) && <AnimatedPlaceholder />}
              <textarea 
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={running}
                rows={1}
                placeholder={running ? (rateLimitCountdown !== null ? `⏳ Rate limited. Retrying in ${rateLimitCountdown}s...` : "Mistral is thinking...") : ""} 
                className="flex-1 bg-transparent text-app-textPrimary placeholder-app-textMuted outline-none text-[16px] md:text-sm min-w-0 resize-none max-h-32 overflow-y-auto custom-scrollbar py-2 relative z-10" 
              />
            </div>

            <button 
                onClick={() => running ? setRunning(false) : handleSubmit()} 
                disabled={!input.trim() && !running}
                className={`relative w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg transition-premium ${
                  running 
                    ? 'bg-white text-[#27262B]' 
                    : 'bg-white hover:bg-gray-200 text-black disabled:bg-[#27262B] disabled:text-white'
                }`}
            >
              <AnimatePresence initial={false}>
                {running ? (
                  <motion.div
                    key="stop"
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <rect width="12" height="12" rx="2" />
                    </svg>
                  </motion.div>
                ) : (
                  <motion.div
                    key="send"
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -15, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="-rotate-90">
                      <path fill="currentColor" d="M12 18v4h4v-4h-4ZM16 14v4h4v-4h-4ZM20 10v4h4v-4h-4ZM16 6v4h4V6h-4ZM12 2v4h4V2h-4ZM12 10v4h4v-4h-4ZM8 10v4h4v-4H8ZM4 10v4h4v-4H4ZM0 10v4h4v-4H0Z"/>
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
          
          <AnimatePresence>
            {messages.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="text-center mt-2 text-[10px] text-app-textMuted/75 mb-4"
              >
                  Mistral is AI and can make mistakes.<span className="hidden md:inline"> Please double-check responses.</span>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </motion.div>
      
      {/* Sunset Stripe Band */}
      <div className="absolute bottom-0 left-0 right-0 h-[8px] z-50 pointer-events-none" style={{ background: 'linear-gradient(to right, #fa520f, #ffa110, #ffb83e, #ffd900, #fff8e0)' }} />



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
                Connect Mistral to your data and tools. <a href="#" className="text-[#a4a098] underline hover:text-[#E8E5DC] transition-colors">Learn more about connectors</a> or explore <a href="#" className="text-[#a4a098] underline hover:text-[#E8E5DC] transition-colors">pre-built ones</a>.
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

    {/* System Instructions Modal */}
    <AnimatePresence>
      {showSystemInstructionsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center font-sans">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowSystemInstructionsModal(false)}
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-[600px] max-w-[95vw] bg-[var(--color-app-main)] rounded-2xl overflow-hidden flex flex-col border border-[var(--color-app-borderLight)] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.3)]"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-app-borderLight)] bg-[var(--color-app-surface)]">
              <h2 className="text-lg font-semibold text-app-textPrimary">System Instructions</h2>
              <button 
                onClick={() => setShowSystemInstructionsModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--color-app-surfaceHover)] text-app-textMuted hover:text-app-textPrimary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <div className="p-6 bg-[var(--color-app-main)]">
              <p className="text-sm text-app-textSecondary mb-4">
                Define the behavior, tone, and constraints for the AI agent. These instructions will be appended to the default system prompt.
              </p>
              
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="w-full h-[200px] bg-[var(--color-app-surface)] text-app-textPrimary border border-[var(--color-app-borderLight)] rounded-xl p-4 text-sm focus:outline-none focus:border-[#fa520f] transition-colors resize-none"
                placeholder="e.g. Always respond in Spanish. Prefer concise answers."
              />
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowSystemInstructionsModal(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--color-app-borderLight)] text-app-textPrimary text-sm font-medium hover:bg-[var(--color-app-surface)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('custom_instructions', customInstructions);
                    setShowSystemInstructionsModal(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#fa520f] hover:bg-[#cc3a05] text-white text-sm font-medium transition-colors"
                >
                  Save Instructions
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    {activeCanvas && (
      <Canvas 
        content={activeCanvas.content} 
        language={activeCanvas.language} 
        onClose={() => setActiveCanvas(null)} 
      />
    )}
  </div>
);
}