const fs = require('fs');

const path = 'src/components/AgentPanel.tsx';
let code = fs.readFileSync(path, 'utf-8');

const returnIndex = code.indexOf('  return (\n');
if (returnIndex === -1) {
    console.error("Could not find return statement");
    process.exit(1);
}

const head = code.slice(0, returnIndex);

const toolCallViewCode = `
const ToolCallView = ({ tc, msg, toolResultMsg, executePendingTools, handleDeny, messages }: any) => {
  const [expanded, setExpanded] = useState(false);
  
  let parsedArgs = tc.function.arguments;
  try {
    if (typeof parsedArgs === 'string') {
      parsedArgs = JSON.stringify(JSON.parse(parsedArgs), null, 2);
    }
  } catch(e) {}

  return (
    <div className="border border-app-border/40 rounded bg-[#161514]/45 overflow-hidden transition-all duration-200">
      <button 
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-app-textSecondary hover:text-app-textPrimary transition-premium bg-app-surface/10" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-[#32302e] flex items-center justify-center text-[7.5px] font-bold text-app-textPrimary">S</div>
          <span className="capitalize">{tc.function.name.replace(/_/g, ' ')}</span>
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
        <div className="border-t border-app-border/20 px-3 py-2.5 text-xs font-mono bg-app-codeBg text-app-textSecondary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[9px] text-app-textMuted uppercase tracking-wider font-sans mb-1 font-bold">Request</div>
              <pre className="overflow-x-auto text-app-textSecondary whitespace-pre-wrap">{parsedArgs}</pre>
            </div>
            {toolResultMsg && (
              <div className="border-t md:border-t-0 md:border-l border-app-border/20 pt-2 md:pt-0 md:pl-4">
                <div className="text-[9px] text-app-textMuted uppercase tracking-wider font-sans mb-1 font-bold">Result</div>
                <pre className="overflow-x-auto text-app-textMuted whitespace-pre-wrap max-h-40 custom-scrollbar">{toolResultMsg.content}</pre>
              </div>
            )}
          </div>
          
          {msg.isApprovalPending && (
            <div className="flex gap-2 mt-4 pt-3 border-t border-app-border/20">
              <button 
                 className="bg-app-textPrimary hover:bg-white text-app-main font-semibold py-1.5 px-4 rounded text-xs transition-colors shadow-sm flex-1"
                 onClick={() => executePendingTools(msg, messages)}
              >
                 Approve
              </button>
              <button 
                 className="bg-transparent border border-app-border hover:bg-app-surface text-app-textPrimary font-semibold py-1.5 px-4 rounded text-xs transition-colors flex-1"
                 onClick={() => handleDeny(msg)}
              >
                 Deny
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

`;

const newReturn = `
  return (
    <main className="flex-1 flex flex-col h-full relative w-full bg-app-main text-app-textPrimary font-sans antialiased overflow-hidden selection:bg-app-surfaceHover selection:text-white">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-app-border/10 shrink-0">
        <div className="flex items-center gap-1 text-xs text-app-textSecondary">
          <span 
            className="hover:text-app-textPrimary cursor-pointer flex items-center gap-1.5 transition-premium" 
            onClick={() => setShowMcpDialog(true)}
          >
            <div className="w-3.5 h-3.5 rounded-[3px] bg-[#32302e] flex items-center justify-center text-[8px] font-bold text-app-textPrimary">
              {demoMcpConnected ? 'S' : mcpConnected ? getMcpName().charAt(0) : 'M'}
            </div>
            {demoMcpConnected ? 'Spotify' : mcpConnected ? getMcpName() : 'Connect'}
          </span>
          <i className="ph-light ph-caret-right text-xxs text-app-textMuted"></i>
          
          <span className="text-app-textPrimary flex items-center gap-2 transition-premium bg-app-surface/40 hover:bg-app-surface/80 border border-app-border/30 px-2 py-0.5 rounded">
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                localStorage.setItem('selected_provider', e.target.value);
              }}
              className="bg-transparent font-medium outline-none cursor-pointer appearance-none text-app-textSecondary"
            >
              <option value="opencode">OpenCode</option>
              <option value="nvidia">NVIDIA</option>
            </select>
            <i className="ph-light ph-caret-right text-xxs text-app-textMuted"></i>
            <select 
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                localStorage.setItem('selected_model', e.target.value);
              }}
              className="bg-transparent font-medium outline-none cursor-pointer appearance-none max-w-[150px] truncate"
            >
              {models.length > 0 ? models.map(m => (
                <option key={m.id} value={m.id} className="bg-app-surface">{m.id.split('/').pop()}</option>
              )) : <option value={model} className="bg-app-surface">{model.split('/').pop()}</option>}
            </select>
          </span>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex bg-app-surface/40 border border-app-border/30 rounded p-0.5">
             <button
               onClick={() => setAgentMode('build')}
               className={\`px-2.5 py-1 text-xs rounded transition-premium \${agentMode === 'build' ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}\`}
             >
               Build
             </button>
             <button
               onClick={() => setAgentMode('plan')}
               className={\`px-2.5 py-1 text-xs rounded transition-premium \${agentMode === 'plan' ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}\`}
             >
               Plan
             </button>
           </div>
           
           <div className="flex bg-app-surface/40 border border-app-border/30 rounded p-0.5">
             <button
               onClick={() => setViewMode('preview')}
               className={\`p-1 rounded transition-premium \${viewMode === 'preview' ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}\`}
             >
               <i className="ph-light ph-eye text-sm"></i>
             </button>
             <button
               onClick={() => setViewMode('raw')}
               className={\`p-1 rounded transition-premium \${viewMode === 'raw' ? 'bg-app-surface text-app-textPrimary shadow-sm' : 'text-app-textMuted hover:text-app-textSecondary'}\`}
             >
               <i className="ph-light ph-code text-sm"></i>
             </button>
           </div>
        </div>
      </header>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-4 md:px-0 pb-36 custom-scrollbar" id="chat-container">
        <div className="max-w-2xl mx-auto py-8 space-y-10">
          {messages.map((msg) => {
            if (msg.role === 'system') {
               return (
                 <div key={msg.id} className="text-center text-xs text-app-textMuted/70 my-2">
                   {msg.content}
                 </div>
               );
            }
            if (msg.role === 'tool') return null; // Tool results handled inside AI blocks
            
            if (msg.role === 'user') {
               return (
                 <div key={msg.id} className="flex justify-end">
                    <div className="bg-app-userBubble/60 border border-app-border/30 px-4 py-3 rounded-xl max-w-[85%] text-sm leading-relaxed text-app-textPrimary/95 whitespace-pre-wrap">
                        {msg.content}
                    </div>
                 </div>
               );
            }

            // AI Block
            return (
              <div key={msg.id} className="text-sm leading-relaxed space-y-5">
                 <div className="space-y-4">
                   {viewMode === 'raw' ? (
                      <pre className="whitespace-pre-wrap font-mono text-[13px] text-app-textSecondary">
                        {msg.content}
                      </pre>
                   ) : (
                      <div className="markdown-body prose prose-invert prose-p:text-app-textSecondary prose-a:text-blue-400 prose-code:text-app-textPrimary prose-code:bg-app-codeBg prose-pre:bg-app-codeBg max-w-none text-[13.5px]">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                   )}
                   
                   {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-4 flex flex-col gap-2">
                        {msg.toolCalls.map((tc: any, i: number) => {
                           const toolResultMsg = messages.find(m => m.role === 'tool' && m.toolCallId === tc.id);
                           return (
                             <ToolCallView key={i} tc={tc} msg={msg} toolResultMsg={toolResultMsg} executePendingTools={executePendingTools} handleDeny={handleDeny} messages={messages} />
                           );
                        })}
                      </div>
                   )}
                 </div>
              </div>
            );
          })}
          
          {running && (
             <div className="flex items-center gap-2 text-xs text-app-textMuted">
                 <Loader2 className="w-3.5 h-3.5 animate-spin" />
                 <span>Claude is thinking...</span>
             </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky Input Area */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-app-main via-app-main/95 to-transparent pt-12 pb-6 px-4 md:px-0 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          {showMentions && filteredFiles.length > 0 && (
            <div className="mb-2 w-full max-h-60 overflow-y-auto bg-app-surface/90 backdrop-blur border border-app-border/40 rounded-xl shadow-xl z-50 custom-scrollbar">
              {filteredFiles.map((file, i) => (
                <div 
                  key={file} 
                  className={\`px-4 py-2 text-xs cursor-pointer truncate transition-premium \${i === mentionIndex ? 'bg-app-surfaceHover text-app-textPrimary' : 'text-app-textSecondary hover:bg-app-surface'}\`}
                  onClick={() => insertMention(file)}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  {file}
                </div>
              ))}
            </div>
          )}
          
          <div className="bg-app-surface/80 backdrop-blur-md border border-app-border/40 rounded-xl shadow-xl flex flex-col focus-within:ring-1 focus-within:ring-app-border/80 focus-within:border-transparent transition-premium">
            <textarea 
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={running}
              rows={1} 
              placeholder={running ? "Claude is thinking..." : "Write a message... (@ to mention files)"} 
              className="w-full bg-transparent text-app-textPrimary placeholder-app-textMuted px-4 pt-3 pb-1 resize-none outline-none max-h-32 min-h-[48px] text-sm" 
            />
            
            <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
                <div className="flex items-center gap-1">
                    <button className="p-1.5 text-app-textMuted hover:text-app-textSecondary rounded hover:bg-app-surface/60 transition-premium" title="Add attachment">
                        <i className="ph-light ph-plus text-md"></i>
                    </button>
                    <button className="p-1.5 text-app-textMuted hover:text-app-textSecondary rounded hover:bg-app-surface/60 transition-premium" title="Use prompt">
                        <i className="ph-light ph-file-text text-md"></i>
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                       onClick={() => handleSubmit()} 
                       disabled={!input.trim() || running}
                       className="p-1.5 bg-app-textPrimary hover:bg-white text-app-main rounded-md disabled:opacity-30 disabled:bg-app-surface disabled:text-app-textMuted transition-premium flex items-center justify-center"
                    >
                       <i className="ph-bold ph-arrow-up text-sm"></i>
                    </button>
                </div>
            </div>
          </div>
          
          <div className="text-center mt-2 text-[10px] text-app-textMuted/75">
              Claude is AI and can make mistakes. Please double-check responses.
          </div>
        </div>
      </div>

      {/* Connectors Modal Overlay */}
      {showMcpDialog && (
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

            <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
              
              {!(mcpConnected || demoMcpConnected) ? (
                 <div className="space-y-4">
                    <div className="flex flex-col items-center text-center space-y-3 mb-4">
                       <div className="w-10 h-10 rounded-xl bg-app-surface flex items-center justify-center text-app-textPrimary border border-app-border/50">
                         <i className="ph-light ph-link text-xl"></i>
                       </div>
                       <h3 className="text-sm font-semibold text-app-textPrimary">Connect MCP Server</h3>
                       <p className="text-xs text-app-textMuted">Add third-party tools to Claude by connecting to an SSE server.</p>
                    </div>

                    <div className="space-y-3">
                       <input
                         type="text"
                         value={mcpUrl}
                         onChange={(e) => setMcpUrl(e.target.value)}
                         placeholder="https://example.com/sse"
                         className="w-full bg-app-surface/20 border border-app-border/40 rounded-lg px-3 py-2 text-xs outline-none focus:border-app-textMuted text-app-textPrimary placeholder-app-textMuted transition-colors"
                       />
                       <button 
                         onClick={handleConnectMcp}
                         className="w-full bg-app-textPrimary hover:bg-white text-app-main font-semibold rounded-lg py-2.5 text-xs transition-all shadow-sm"
                       >
                         Connect Server
                       </button>
                       <button 
                         onClick={() => {
                           setDemoMcpConnected(true);
                           const demoPerms = { ...toolPermissions };
                           SPOTIFY_DEMO_TOOLS.forEach((t, index) => {
                             if (index === 7) demoPerms[t.function.name] = 'ask';
                             else demoPerms[t.function.name] = 'allow';
                           });
                           setToolPermissions(demoPerms);
                           setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: \`Connected to demo Spotify MCP server. 8 tools loaded.\` }]);
                         }}
                         className="w-full bg-app-surface/50 hover:bg-app-surface border border-app-border/40 text-app-textPrimary font-semibold rounded-lg py-2.5 text-xs transition-all flex items-center justify-center gap-1.5"
                       >
                         <i className="ph-fill ph-lightning text-[#da7c5c]"></i> Load Demo Spotify Connector
                       </button>
                    </div>
                 </div>
              ) : (
                 <div className="space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-[#252422] border border-app-border/40 flex items-center justify-center text-xs font-semibold text-app-textPrimary">
                                {demoMcpConnected ? "S" : getMcpName().charAt(0)}
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-app-textPrimary">{demoMcpConnected ? "Spotify" : getMcpName()}</div>
                            </div>
                        </div>
                        <button 
                           onClick={handleDisconnectMcp}
                           className="px-2.5 py-1 text-xs text-app-textSecondary bg-[#23211f] hover:bg-app-surface border border-app-border/40 rounded transition-premium"
                        >
                           Disconnect
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-app-surface/20 border border-app-border/20 rounded font-mono text-xs text-app-textSecondary">
                        <span className="truncate max-w-[320px]">{demoMcpConnected ? "https://spoti-mcp.duckdns.org/sse" : mcpUrl}</span>
                        <button onClick={() => handleCopyUrl(demoMcpConnected ? "https://spoti-mcp.duckdns.org/sse" : mcpUrl)} className="text-app-textMuted hover:text-app-textPrimary p-1 rounded transition-premium">
                            {copied ? <i className="ph-bold ph-check text-green-500 text-xs"></i> : <i className="ph-light ph-copy text-xs"></i>}
                        </button>
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
      )}

    </main>
  );
}
`;

fs.writeFileSync(path, head + toolCallViewCode + newReturn);
console.log("Rewrote AgentPanel.tsx successfully");
