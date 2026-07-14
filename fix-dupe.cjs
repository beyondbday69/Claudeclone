const fs = require('fs');
const path = 'src/components/AgentPanel.tsx';
let code = fs.readFileSync(path, 'utf-8');

const toolCallViewOldStart = `const ToolCallView = ({ tc, msg, toolResultMsg, executePendingTools, handleDeny, messages, isLast }: any) => {`;
const toolCallViewIndices = [];
let idx = code.indexOf(toolCallViewOldStart);
while (idx !== -1) {
  toolCallViewIndices.push(idx);
  idx = code.indexOf(toolCallViewOldStart, idx + 1);
}
console.log('ToolCallView indices:', toolCallViewIndices);

const agentPanelIndices = [];
idx = code.indexOf('export default function AgentPanel');
while (idx !== -1) {
  agentPanelIndices.push(idx);
  idx = code.indexOf('export default function AgentPanel', idx + 1);
}
console.log('AgentPanel indices:', agentPanelIndices);

