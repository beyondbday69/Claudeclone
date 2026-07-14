const fs = require('fs');
const path = 'src/components/AgentPanel.tsx';
let code = fs.readFileSync(path, 'utf-8');

const toolCallViewOldStart = `const ToolCallView = ({ tc, msg, toolResultMsg, executePendingTools, handleDeny, messages }: any) => {`;
const toolCallViewStartIdx = code.indexOf(toolCallViewOldStart);
if (toolCallViewStartIdx === -1) {
    console.error("Could not find ToolCallView");
    process.exit(1);
}

// Find the end of ToolCallView
// It ends right before "return (" of the main component which is "export default function AgentPanel"
const agentPanelIdx = code.indexOf('export default function AgentPanel');
if (agentPanelIdx === -1) {
    console.error("Could not find AgentPanel");
    process.exit(1);
}

let newToolCallView = `const ToolCallView = ({ tc, msg, toolResultMsg, executePendingTools, handleDeny, messages, isLast }: any) => {
  const [expanded, setExpanded] = useState(false);
  
  let parsedArgs = tc.function.arguments;
  try {
    if (typeof parsedArgs === 'string') {
      parsedArgs = JSON.stringify(JSON.parse(parsedArgs), null, 2);
    }
  } catch(e) {}

  return (
    <div className="relative pl-6 py-1 group">
      {!isLast && (
        <div className="absolute left-[3px] top-[18px] bottom-[-10px] w-[1px] bg-app-border/60 z-0"></div>
      )}
      <div className="absolute left-[0px] top-[11px] w-[7px] h-[7px] rounded-full bg-[#32302e] border-[1.5px] border-[#32302e] z-10 group-hover:bg-app-textPrimary transition-colors"></div>

      <div className="flex flex-col gap-2">
        <button 
          className="w-full flex items-center justify-between text-xs font-mono text-app-textSecondary hover:text-app-textPrimary transition-premium rounded py-1" 
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <span className="capitalize font-semibold">{tc.function.name.replace(/_/g, ' ')}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-app-textMuted font-sans">
            {isRiskyTool(tc.function.name) && msg.isApprovalPending && (
               <span className="text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded font-bold">APPROVAL NEEDED</span>
            )}
            {toolResultMsg && (
               <span className="text-emerald-500 bg-emerald-950/30 px-1.5 py-0.5 rounded font-bold">COMPLETED</span>
            )}
            {!toolResultMsg && !msg.isApprovalPending && (
               <span className="text-app-textSecondary flex items-center gap-1 font-bold">
                  <Loader2 className="w-3 h-3 animate-spin" /> RUNNING
               </span>
            )}
            <i className={\`ph-light \${expanded ? 'ph-caret-up' : 'ph-caret-down'} text-[10px]\`}></i>
          </div>
        </button>
        
        {expanded && (
          <div className="text-xs font-mono bg-app-codeBg text-app-textSecondary rounded border border-app-border/30 overflow-hidden mb-2">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="p-3">
                <div className="text-[9px] text-app-textMuted uppercase tracking-wider font-sans mb-1 font-bold">Request</div>
                <pre className="overflow-x-auto text-app-textSecondary whitespace-pre-wrap">{parsedArgs}</pre>
              </div>
              {toolResultMsg && (
                <div className="p-3 border-t md:border-t-0 md:border-l border-app-border/30 bg-[#141312]">
                  <div className="text-[9px] text-app-textMuted uppercase tracking-wider font-sans mb-1 font-bold">Result</div>
                  <pre className="overflow-x-auto text-app-textMuted whitespace-pre-wrap max-h-40 custom-scrollbar">{toolResultMsg.content}</pre>
                </div>
              )}
            </div>
          </div>
        )}
        
        {msg.isApprovalPending && (
          <div className="flex gap-2 mt-1 mb-2">
            <button 
               className="bg-app-textPrimary hover:bg-white text-app-main font-semibold py-1 px-4 rounded text-xs transition-colors shadow-sm flex-1"
               onClick={() => executePendingTools(msg, messages)}
            >
               Approve
            </button>
            <button 
               className="bg-transparent border border-app-border hover:bg-app-surface text-app-textPrimary font-semibold py-1 px-4 rounded text-xs transition-colors flex-1"
               onClick={() => handleDeny(msg)}
            >
               Deny
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
`;

code = code.slice(0, toolCallViewStartIdx) + newToolCallView + '\n' + code.slice(agentPanelIdx);

// Replace ToolCallView invocation
const oldInvocation = `<ToolCallView key={i} tc={tc} msg={msg} toolResultMsg={toolResultMsg} executePendingTools={executePendingTools} handleDeny={handleDeny} messages={messages} />`;
const newInvocation = `<ToolCallView key={i} tc={tc} msg={msg} toolResultMsg={toolResultMsg} executePendingTools={executePendingTools} handleDeny={handleDeny} messages={messages} isLast={i === msg.toolCalls.length - 1} />`;
code = code.replace(oldInvocation, newInvocation);

// Also change flex-col gap-2 container for tool calls to gap-0 or something else if needed
code = code.replace('<div className="mt-4 flex flex-col gap-2">', '<div className="mt-4 flex flex-col gap-0 pl-1">');

fs.writeFileSync(path, code);
