const fs = require('fs');
let code = fs.readFileSync('src/components/AgentPanel.tsx', 'utf-8');

const oldFunc = `  const getMcpName = () => {
    try {
      const url = new URL(mcpUrl);
      if (url.hostname.includes('spoti')) return "Spotify";
      const hostPart = url.hostname.split('.')[0];
      return hostPart.charAt(0).toUpperCase() + hostPart.slice(1);
    } catch (e) { return "MCP Server"; }
  };`;

const newFunc = `  const getMcpName = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      if (url.hostname.includes('spoti')) return "Spotify";
      const hostPart = url.hostname.split('.')[0];
      return hostPart.charAt(0).toUpperCase() + hostPart.slice(1);
    } catch (e) { return "MCP Server"; }
  };`;

if (code.includes('const getMcpName = () => {')) {
    // let's do a substring replace
    const start = code.indexOf('const getMcpName = () => {');
    const end = code.indexOf('};', start) + 2;
    code = code.substring(0, start) + newFunc + code.substring(end);
}

fs.writeFileSync('src/components/AgentPanel.tsx', code);
