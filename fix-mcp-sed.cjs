const fs = require('fs');
let code = fs.readFileSync('src/components/AgentPanel.tsx', 'utf-8');

const regexGetMcpName = /const getMcpName = \(\) => \{[\s\S]*?return hostPart\.charAt\(0\)\.toUpperCase\(\) \+ hostPart\.slice\(1\);\n\s*\} catch \(e\) \{ return "MCP Server"; \}\n\s*\};/;

code = code.replace(regexGetMcpName, `const getMcpName = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      if (url.hostname.includes('spoti')) return "Spotify";
      const hostPart = url.hostname.split('.')[0];
      return hostPart.charAt(0).toUpperCase() + hostPart.slice(1);
    } catch (e) { return "MCP Server"; }
  };`);
fs.writeFileSync('src/components/AgentPanel.tsx', code);
