import re

with open('src/components/AgentPanel.tsx', 'r') as f:
    content = f.read()

# Replace SPOTIFY_DEMO_TOOLS array and references
content = re.sub(r'const SPOTIFY_DEMO_TOOLS = \[\s*\{[\s\S]*?\}\s*\];\s*', '', content, flags=re.MULTILINE)

# Remove demoMcpConnected state variable
content = re.sub(r'const \[demoMcpConnected, setDemoMcpConnected\] = useState\(false\);\n?', '', content)

# Remove mcpConnected state variable
content = re.sub(r'const \[mcpConnected, setMcpConnected\] = useState\(false\);\n?', '', content)

# Remove mcpUrl state variable
content = re.sub(r'const \[mcpUrl, setMcpUrl\] = useState\(.*?;\n?', '', content)

# Remove demo execution logic
content = re.sub(r'\} else if \(demoMcpConnected && SPOTIFY_DEMO_TOOLS\.some\(t => t\.function\.name === toolName\)\) \{[\s\S]*?\} else if \(getTools', '} else if (getTools', content)

# Replace getActiveMcpTools logic
content = re.sub(r'const getActiveMcpTools = \(\) => \{[\s\S]*?return getMcpTools\(\);\n  \};\n', 'const getActiveMcpTools = () => {\n    return getMcpTools();\n  };\n', content)

# Rewrite handleConnectMcp and handleDisconnectMcp
content = re.sub(r'const handleConnectMcp = async \(\) => \{[\s\S]*?const handleDisconnectMcp = \(\) => \{[\s\S]*?\};\n', '''const handleConnectMcp = async () => {
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
    disconnectMcp(url);
    setMcpServers(mcpServers.filter(u => u !== url));
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Disconnected from MCP server ${url}.` }]);
  };
''', content)

# The modal is complex. Let's find it.
modal_match = re.search(r'\{!\(mcpConnected \|\| demoMcpConnected\) \? \([\s\S]*?\}\n\s*</div>\n\s*\)\}\n\s*</div>\n\s*</div>\n\s*</div>\n\s*\)\}', content)
# We actually can just replace the body of the modal.
