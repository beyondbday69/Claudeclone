const fs = require('fs');
const path = 'src/components/AgentPanel.tsx';
let code = fs.readFileSync(path, 'utf-8');

const oldToolCallViewRegex = /const ToolCallView = \(\{ tc, msg, toolResultMsg, executePendingTools, handleDeny, messages, isLast \}: any\) => \{[\s\S]*?(?=return \(\n\s*<main className="flex-1 flex flex-col)/;

const match = code.match(oldToolCallViewRegex);
if (!match) {
    console.error("Could not find ToolCallView or main block");
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

  let resultStr = toolResultMsg ? toolResultMsg.content : "";
  try {
    if (resultStr) {
       const parsedRes = JSON.parse(resultStr);
       if (parsedRes.error) {
          resultStr = parsedRes.error;
       } else if (parsedRes.message) {
          resultStr = parsedRes.message;
       } else if (parsedRes.content) {
          resultStr = typeof parsedRes.content === 'string' ? parsedRes.content : JSON.stringify(parsedRes.content, null, 2);
       } else if (parsedRes.success !== undefined && Object.keys(parsedRes).length === 1) {
          resultStr = "Success";
       } else {
          resultStr = JSON.stringify(parsedRes, null, 2);
       }
    }
  } catch(e) {}

  const isRunning = !toolResultMsg && !msg.isApprovalPending;

  return (
    <div className="relative pl-6 py-1 group">
      {!isLast && (
        <div className="absolute left-[3px] top-[18px] -bottom-[11px] w-[1px] bg-app-border/60 z-0"></div>
      )}
      <div className={\`absolute left-[0px] top-[11px] w-[7px] h-[7px] rounded-full bg-app-main border z-10 group-hover:border-app-textPrimary transition-colors \${isRunning ? 'animate-pulse border-app-textPrimary bg-app-surfaceHover' : 'border-app-textMuted'}\`}></div>

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
            {isRunning && (
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
                  <pre className="overflow-x-auto text-app-textMuted whitespace-pre-wrap max-h-40 custom-scrollbar">{resultStr}</pre>
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

code = code.replace(match[0], newToolCallView);
fs.writeFileSync(path, code);
console.log("Successfully replaced ToolCallView");
