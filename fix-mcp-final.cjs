const fs = require('fs');
let code = fs.readFileSync('src/components/AgentPanel.tsx', 'utf-8');

// Replace the getMcpName function completely
code = code.replace(
  /const getMcpName = \(\) => \{[\s\S]*?return hostPart\.charAt\(0\)\.toUpperCase\(\) \+ hostPart\.slice\(1\);\n    \} catch \(e\) \{ return "MCP Server"; \}\n  \};\n/,
  `const getMcpName = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      if (url.hostname.includes('spoti')) return "Spotify";
      const hostPart = url.hostname.split('.')[0];
      return hostPart.charAt(0).toUpperCase() + hostPart.slice(1);
    } catch (e) { return "MCP Server"; }
  };
`
);

// We need to replace the old modal content. 
// Since my previous replace regex didn't match, let's look at the actual modal content in the file.
// I'll just find the start of the modal and replace until the end of the modal.
const modalStartStr = '{showMcpDialog && (\\s*<div className="fixed inset-0 bg=\\[#0c0c0b\\]/80 backdrop-blur-sm z-\\[100\\] flex items-center justify-center p-4 animate-in fade-in duration-200">\\s*<div className="bg-app-modalBg border border-app-border/50 rounded-lg w-full max-w-\\[500px\\] shadow-2xl flex flex-col overflow-hidden max-h-\\[85vh\\] animate-in zoom-in-95 duration-200">\\s*<div className="flex items-center justify-between px-5 py-3\\.5 border-b border-app-border/20">\\s*<div className="flex items-center gap-2 text-app-textSecondary">\\s*<i className="ph-light ph-link text-md"></i>\\s*<span className="text-xs font-semibold uppercase tracking-wider">Connectors</span>\\s*</div>\\s*<button className="text-app-textMuted hover:text-app-textPrimary transition-premium" onClick=\\{\\(\\) => setShowMcpDialog\\(false\\)\\}>\\s*<i className="ph-light ph-x text-md"></i>\\s*</button>\\s*</div>';
const regexModal = new RegExp(modalStartStr + '[\\s\\S]*?</div>\\s*</div>\\s*</div>\\s*\\)}', 'g');

const newModalStr = `{showMcpDialog && (
        <div className="fixed inset-0 bg-[#0c0c0b]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-app-modalBg border border-app-border/50 rounded-lg w-full max-w-[500px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-app-border/20">
              <div className="flex items-center gap-2 text-app-textSecondary">
                <i className="ph-light ph-link text-md"></i>
                <span className="text-xs font-semibold uppercase tracking-wider">Connectors</span>
              </div>
              <button className="text-app-textMuted hover:text-app-textPrimary transition-premium" onClick={() => setShowMcpDialog(false)}>
                <i className="ph-light ph-x text-md"></i>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
               {mcpServers.length === 0 ? (
                 <div className="p-6 flex flex-col items-center justify-center text-center">
                     <div className="w-12 h-12 bg-app-surface border border-app-border/40 rounded-full flex items-center justify-center mb-4">
                         <i className="ph-light ph-plug text-xl text-app-textSecondary"></i>
                     </div>
                     <h3 className="text-sm font-semibold text-app-textPrimary">Connect MCP Server</h3>
                     <p className="text-xs text-app-textMuted mt-1 mb-6 max-w-[280px]">Extend your AI assistant with custom tools and integrations via the Model Context Protocol.</p>
                     
                     <div className="w-full flex gap-2">
                         <input 
                         type="text" 
                         placeholder="Enter SSE URL (e.g., http://localhost:3001/sse)" 
                         value={mcpInputUrl}
                         onChange={(e) => setMcpInputUrl(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleConnectMcp()}
                         className="flex-1 bg-app-surface border border-app-border/30 rounded px-3 py-1.5 text-xs text-app-textPrimary focus:outline-none focus:border-app-textSecondary transition-premium"
                         />
                         <button 
                         onClick={handleConnectMcp}
                         className="bg-app-textPrimary text-black px-4 py-1.5 rounded text-xs font-semibold hover:bg-white transition-premium"
                         >
                         Connect
                         </button>
                     </div>
                 </div>
               ) : (
                 <div className="flex flex-col gap-5">
                    <div className="w-full flex gap-2">
                         <input 
                         type="text" 
                         placeholder="Connect another SSE URL..." 
                         value={mcpInputUrl}
                         onChange={(e) => setMcpInputUrl(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && handleConnectMcp()}
                         className="flex-1 bg-app-surface border border-app-border/30 rounded px-3 py-1.5 text-xs text-app-textPrimary focus:outline-none focus:border-app-textSecondary transition-premium"
                         />
                         <button 
                         onClick={handleConnectMcp}
                         className="bg-app-surface text-app-textPrimary border border-app-border/30 px-3 py-1.5 rounded text-xs font-semibold hover:bg-app-surfaceHover transition-premium"
                         >
                         Add
                         </button>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-app-textSecondary">Connected Servers</h4>
                      {mcpServers.map(url => (
                        <div key={url} className="flex flex-col p-2.5 bg-app-surface/20 border border-app-border/20 rounded font-mono text-xs text-app-textSecondary mb-2 gap-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded bg-[#2e302d] border border-app-border/30 flex items-center justify-center text-xs font-semibold text-app-textPrimary">
                                        {getMcpName(url).charAt(0)}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <div className="text-sm font-semibold text-app-textPrimary truncate">{getMcpName(url)}</div>
                                        <span className="truncate max-w-[200px] text-[10px]">{url}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleCopyUrl(url)} className="text-app-textMuted hover:text-app-textPrimary p-1 rounded transition-premium">
                                        <i className="ph-light ph-copy text-xs"></i>
                                    </button>
                                    <button
                                        onClick={() => handleDisconnectMcp(url)}
                                    className="px-2.5 py-1 text-xs text-app-textSecondary bg-[#23211f] hover:bg-app-surface border border-app-border/40 rounded transition-premium"
                                    >
                                    Disconnect
                                    </button>
                                </div>
                            </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-2 border-t border-app-border/20 space-y-3">
                        <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-app-textSecondary">Tool permissions</h4>
                            <p className="text-[11px] text-app-textMuted mt-0.5">Control execution rules for individual operations.</p>
                        </div>
                        <div className="border border-app-border/40 rounded bg-[#141312]">
                            <div className="flex items-center justify-between px-3 py-2 bg-app-surface/20 border-b border-app-border/40">
                                <button onClick={() => setMcpCollapsed(!mcpCollapsed)} className="flex items-center gap-2">
                                    <i className={\`ph-light \${mcpCollapsed ? 'ph-caret-right' : 'ph-caret-down'} text-xxs text-app-textMuted\`}></i>
                                    <span className="text-xs font-medium text-app-textPrimary">Available tools</span>
                                    <span className="bg-app-surface text-app-textMuted text-[9px] px-1.5 py-0.2 rounded-full">{getActiveMcpTools().length}</span>
                                </button>
                                
                                <div className="relative">
                                    <button
                                       onClick={() => setActivePresetMenu(activePresetMenu === 'mcp' ? null : 'mcp')}
                                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-app-surface hover:bg-app-surfaceHover text-app-textSecondary border border-app-border/40 rounded transition-premium"
                                    >
                                        <span>... {getPresetLabel('mcp')}</span>
                                        <i className="ph-light ph-caret-down text-[8px]"></i>
                                    </button>
                                    
                                    {activePresetMenu === 'mcp' && (
                                       <>
                                         <div className="fixed inset-0 z-40" onClick={() => setActivePresetMenu(null)} />
                                         <div className="absolute right-0 mt-1 w-28 bg-app-surface border border-app-border rounded shadow-xl z-50">
                                             <button onClick={() => applyPreset('mcp', 'allow')} className="w-full text-left px-2 py-1.5 text-[10px] text-app-textSecondary hover:text-app-textPrimary hover:bg-app-surfaceHover border-b border-app-border/10">Always allow</button>
                                             <button onClick={() => applyPreset('mcp', 'ask')} className="w-full text-left px-2 py-1.5 text-[10px] text-app-textSecondary hover:text-app-textPrimary hover:bg-app-surfaceHover border-b border-app-border/10">Ask each time</button>
                                             <button onClick={() => applyPreset('mcp', 'block')} className="w-full text-left px-2 py-1.5 text-[10px] text-app-textSecondary hover:text-app-textPrimary hover:bg-app-surfaceHover">Never allow</button>
                                         </div>
                                       </>
                                    )}
                                </div>
                            </div>
                            {!mcpCollapsed && (
                               <div className="divide-y divide-app-border/20 text-xs font-mono text-app-textSecondary max-h-64 overflow-y-auto custom-scrollbar">
                                  {getActiveMcpTools().map((tool: any) => {
                                      const name = tool.function.name;
                                      const permission = getToolPermission(name);
                                      return (
                                        <div key={name} className="flex items-center justify-between px-3 py-1.5 hover:bg-app-surface/20 transition-premium">
                                            <div className="flex flex-col min-w-0 pr-2">
                                              <span className="text-xs text-app-textSecondary tracking-tight truncate">{humanizeToolName(name)}</span>
                                              <span className="text-[9px] text-app-textMuted truncate font-sans">{tool.function.description}</span>
                                            </div>
                                            <div className="flex items-center gap-1 bg-[#131211] p-0.5 rounded border border-app-border/10 shrink-0">
                                                <button onClick={() => setToolPermissions(prev => ({ ...prev, [name]: 'allow' }))} className={\`w-5 h-5 flex items-center justify-center rounded transition-premium text-[10px] \${permission === 'allow' ? 'bg-app-surface text-app-textPrimary border border-app-borderLight/30' : 'text-app-textMuted border border-transparent hover:text-app-textSecondary'}\`} title="Always Allow">
                                                    <i className="ph-bold ph-check"></i>
                                                </button>
                                                <button onClick={() => setToolPermissions(prev => ({ ...prev, [name]: 'ask' }))} className={\`w-5 h-5 flex items-center justify-center rounded transition-premium text-[10px] \${permission === 'ask' ? 'bg-app-surface text-app-textPrimary border border-app-borderLight/30' : 'text-app-textMuted border border-transparent hover:text-app-textSecondary'}\`} title="Ask each time">
                                                    <i className="ph-bold ph-hand-palm"></i>
                                                </button>
                                                <button onClick={() => setToolPermissions(prev => ({ ...prev, [name]: 'block' }))} className={\`w-5 h-5 flex items-center justify-center rounded transition-premium text-[10px] \${permission === 'block' ? 'bg-app-surface text-app-textPrimary border border-app-borderLight/30' : 'text-app-textMuted border border-transparent hover:text-app-textSecondary'}\`} title="Never Allow">
                                                    <i className="ph-bold ph-prohibit"></i>
                                                </button>
                                            </div>
                                        </div>
                                      );
                                  })}
                               </div>
                            )}
                        </div>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}`;

code = code.replace(regexModal, newModalStr);

fs.writeFileSync('src/components/AgentPanel.tsx', code);
