const fs = require('fs');
let code = fs.readFileSync('src/components/AgentPanel.tsx', 'utf-8');

// replace useEffect for auto-connect
const oldAutoConnect = `  useEffect(() => {
    mcpServers.forEach(url => connectMcp(url).catch(console.error));
  }, []);`;

const newAutoConnect = `  const [mcpReloadState, setMcpReloadState] = useState(0);
  useEffect(() => {
    mcpServers.forEach(url => {
        connectMcp(url).then(res => {
            if (res.success) {
                setMcpReloadState(prev => prev + 1);
            }
        }).catch(console.error);
    });
  }, []);`;

code = code.replace(oldAutoConnect, newAutoConnect);
fs.writeFileSync('src/components/AgentPanel.tsx', code);
