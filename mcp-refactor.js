const fs = require('fs');
let code = fs.readFileSync('src/components/AgentPanel.tsx', 'utf-8');

// Remove SPOTIFY_DEMO_TOOLS
code = code.replace(/const SPOTIFY_DEMO_TOOLS = \[\s*\{[\s\S]*?\}\s*\];\s*/m, '');

// State changes
code = code.replace(/const \[mcpUrl, setMcpUrl\] = useState\('https:\/\/evkwg-31-42-125-107\.free\.pinggy\.net\/sse'\);\s*/g, '');
code = code.replace(/const \[mcpConnected, setMcpConnected\] = useState\(false\);\s*/g, '');
code = code.replace(/const \[demoMcpConnected, setDemoMcpConnected\] = useState\(false\);\s*/g, '');

code = code.replace(
  /const \[showMcpDialog, setShowMcpDialog\] = useState\(false\);/,
  `const [showMcpDialog, setShowMcpDialog] = useState(false);\n  const [mcpInputUrl, setMcpInputUrl] = useState('');\n  const [mcpServers, setMcpServers] = useState<string[]>(() => {\n    try {\n      const saved = localStorage.getItem('mcp_servers');\n      return saved ? JSON.parse(saved) : [];\n    } catch (e) { return []; }\n  });\n  useEffect(() => {\n    localStorage.setItem('mcp_servers', JSON.stringify(mcpServers));\n  }, [mcpServers]);`
);

// We need an effect to auto connect on reload
code = code.replace(
  /useEffect\(\(\) => \{\n    localStorage\.setItem\('chat_sessions', JSON\.stringify\(newSessions\)\);\n    \}\n  \}, \[messages, sessionId\]\);/g,
  `useEffect(() => {\n    if (messages.length > 1) {\n      setSessions(prevSessions => {\n        const existing = prevSessions.find(s => s.id === sessionId);\n        const name = existing?.name || messages.find(m => m.role === 'user')?.content.slice(0, 40) || 'New Chat';\n        const updatedSessions = prevSessions.filter(s => s.id !== sessionId);\n        const newSession = {\n          id: sessionId,\n          name,\n          updatedAt: Date.now(),\n          messages\n        };\n        const newSessions = [newSession, ...updatedSessions].slice(0, 50);\n        localStorage.setItem('chat_sessions', JSON.stringify(newSessions));\n        return newSessions;\n      });\n    }\n  }, [messages, sessionId]);\n\n  useEffect(() => {\n    mcpServers.forEach(url => connectMcp(url).catch(console.error));\n  }, []);`
);

fs.writeFileSync('src/components/AgentPanel.tsx', code);
