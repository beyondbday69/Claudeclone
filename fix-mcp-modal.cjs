const fs = require('fs');
let code = fs.readFileSync('src/components/AgentPanel.tsx', 'utf-8');

// Replace the modal content
code = code.replace(
  /\{!\(mcpServers\.length > 0 \|\| false\) \? \([\s\S]*?className="text-sm font-semibold text-app-textPrimary"\{demoMcpConnected \? "Spotify" : getMcpName\(\)\}<\/div>/,
  `TODO`
);

fs.writeFileSync('src/components/AgentPanel.tsx', code);
