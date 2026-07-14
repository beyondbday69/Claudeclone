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

// We need an effect to auto connect on reload. Adding to the end of the imports
code = code.replace(
  /export default function AgentPanel\(\{ owner, repo, branch, octokit \}: AgentPanelProps\) \{/,
  `export default function AgentPanel({ owner, repo, branch, octokit }: AgentPanelProps) {`
);

fs.writeFileSync('src/components/AgentPanel.tsx', code);
