const fs = require('fs');
let code = fs.readFileSync('src/components/AgentPanel.tsx', 'utf-8');

// getMcpName, getActiveMcpTools, etc
code = code.replace(
  /const getActiveMcpTools = \(\) => \{[\s\S]*?return getMcpTools\(\);\n  \};\n/,
  `const getActiveMcpTools = () => {\n    return getMcpTools();\n  };\n`
);

code = code.replace(
  /const getMcpName = \(\) => \{[\s\S]*?return url\.hostname;\n    \} catch \(e\) \{ return "MCP Server"; \}\n  \};\n/,
  `const getMcpName = (urlStr: string) => {\n    try {\n      const url = new URL(urlStr);\n      return url.hostname;\n    } catch (e) { return "MCP Server"; }\n  };\n`
);

// handleConnectMcp and handleDisconnectMcp
code = code.replace(
  /const handleConnectMcp = async \(\) => \{[\s\S]*?const handleDisconnectMcp = \(\) => \{[\s\S]*?\};\n/,
  `const handleConnectMcp = async () => {\n    if (!mcpInputUrl.trim()) return;\n    const result = await connectMcp(mcpInputUrl.trim());\n    if (result.success) {\n       if (!mcpServers.includes(mcpInputUrl.trim())) {\n           setMcpServers([...mcpServers, mcpInputUrl.trim()]);\n       }\n       setMcpInputUrl('');\n       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: \`Connected to MCP server. \${result.tools?.length || 0} tools loaded.\` }]);\n    } else {\n       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: \`Failed to connect to MCP server. Error: \${result.error}\` }]);\n    }\n  };\n\n  const handleDisconnectMcp = (url: string) => {\n    // Ideally call disconnectMcp(url)\n    setMcpServers(mcpServers.filter(u => u !== url));\n    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: \`Disconnected from MCP server \${url}.\` }]);\n  };\n`
);

// Auto-connect effect
code = code.replace(
  /export default function AgentPanel\(\{ owner, repo, branch, octokit \}: AgentPanelProps\) \{/,
  `import { getConnectedMcpUrls, disconnectMcp } from '../utils/mcpClient';\nexport default function AgentPanel({ owner, repo, branch, octokit }: AgentPanelProps) {\n  useEffect(() => {\n    mcpServers.forEach(url => connectMcp(url).catch(console.error));\n  }, []);\n`
);

// Tool execution demo branch removal
code = code.replace(
  /\} else if \(demoMcpConnected && SPOTIFY_DEMO_TOOLS\.some\(t => t\.function\.name === toolName\)\) \{[\s\S]*?\} else if \(getTools/g,
  `} else if (getTools`
);

// Top bar UI changes
code = code.replace(
  /\{demoMcpConnected \? 'S' : mcpConnected \? getMcpName\(\)\.charAt\(0\) : 'M'\}/g,
  `{mcpServers.length > 0 ? getConnectedMcpUrls().length : 'M'}`
);

code = code.replace(
  /\{demoMcpConnected \? 'Spotify' : mcpConnected \? getMcpName\(\) : 'Connect'\}/g,
  `{mcpServers.length > 0 ? \`\${getConnectedMcpUrls().length} MCP(s)\` : 'Connect'}`
);

fs.writeFileSync('src/components/AgentPanel.tsx', code);
