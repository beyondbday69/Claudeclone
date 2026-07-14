const fs = require('fs');
const path = 'src/components/AgentPanel.tsx';
let code = fs.readFileSync(path, 'utf-8');
const lines = code.split('\n');

const firstAgentPanelIdx = lines.findIndex(l => l.includes('export default function AgentPanel'));
const secondAgentPanelIdx = lines.findIndex((l, i) => i > firstAgentPanelIdx && l.includes('export default function AgentPanel'));

if (secondAgentPanelIdx !== -1) {
    console.log(`Found duplicate AgentPanel at line ${secondAgentPanelIdx + 1}. Deleting from ${firstAgentPanelIdx + 1} to ${secondAgentPanelIdx}...`);
    lines.splice(firstAgentPanelIdx, secondAgentPanelIdx - firstAgentPanelIdx);
    fs.writeFileSync(path, lines.join('\n'));
    console.log('Done.');
} else {
    console.log('No duplicate AgentPanel found.');
}
