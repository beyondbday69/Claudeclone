const fs = require('fs');
let code = fs.readFileSync('src/components/AgentPanel.tsx', 'utf8');

// Imports
code = code.replace(/import '@m3e\/web\/button';\n/g, '');
code = code.replace(/import '@m3e\/web\/icon';\n/g, '');
code = code.replace(/import '@m3e\/web\/icon-button';\n/g, '');
code = code.replace(/import '@m3e\/web\/loading-indicator';\n/g, '');
code = code.replace(/import '@m3e\/web\/card';\n/g, '');
code = code.replace(/import '@m3e\/web\/divider';\n/g, '');
code = code.replace(/import React, { useState, useRef, useEffect } from 'react';/, "import React, { useState, useRef, useEffect } from 'react';\nimport { Bot, Terminal, Send, Check, Loader2 } from 'lucide-react';");

// Container
code = code.replace(/bg-\[var\(--md-sys-color-surface-container-lowest\)\]/g, 'bg-[#09090b]');
code = code.replace(/text-\[var\(--md-sys-color-on-surface\)\]/g, 'text-zinc-100');
code = code.replace(/border-\[var\(--md-sys-color-outline-variant\)\]/g, 'border-zinc-800');
code = code.replace(/bg-\[var\(--md-sys-color-surface-container-low\)\]/g, 'bg-[#09090b]');
code = code.replace(/bg-\[var\(--md-sys-color-surface-container-highest\)\]/g, 'bg-zinc-900');
code = code.replace(/bg-\[var\(--md-sys-color-surface-container\)\]/g, 'bg-zinc-900');
code = code.replace(/bg-\[var\(--md-sys-color-surface-variant\)\]/g, 'bg-zinc-900');
code = code.replace(/text-\[var\(--md-sys-color-on-surface-variant\)\]/g, 'text-zinc-400');
code = code.replace(/bg-\[var\(--md-sys-color-primary-container\)\]/g, 'bg-zinc-800');
code = code.replace(/text-\[var\(--md-sys-color-on-primary-container\)\]/g, 'text-zinc-100');
code = code.replace(/text-\[var\(--md-sys-color-primary\)\]/g, 'text-zinc-100');
code = code.replace(/ring-\[var\(--md-sys-color-primary\)\]/g, 'ring-zinc-700');
code = code.replace(/bg-\[var\(--md-sys-color-error-container\)\]/g, 'bg-red-950/50');
code = code.replace(/text-\[var\(--md-sys-color-error\)\]/g, 'text-red-400');
code = code.replace(/bg-\[var\(--md-sys-color-surface-container-high\)\]/g, 'bg-zinc-900');

// Header
code = code.replace(/<m3e-icon style=\{\{ color: 'var\(--md-sys-color-primary\)', fontSize: '18px' \}\}>smart_toy<\/m3e-icon>/, '<Bot className="w-5 h-5" />');
code = code.replace(/\{running && <m3e-loading-indicator[^>]*><\/m3e-loading-indicator>\}/, '{running && <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />}');

// Tool msg ✓
code = code.replace(/<span className="text-zinc-100 font-bold">✓<\/span>/, '<Check className="w-3.5 h-3.5 mt-0.5 text-zinc-500 shrink-0" />');
code = code.replace(/<div className="flex items-start gap-2">/, '<div className="flex items-start gap-2 text-zinc-500">');

// Tool calls mapping
code = code.replace(/<m3e-card key=\{i\} variant="outlined" style=\{\{ padding: '8px', backgroundColor: 'var\(--md-sys-color-surface-container-high\)', border: 'none' \}\}>/g, '<div key={i} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">');
code = code.replace(/<\/m3e-card>/g, '</div>');
code = code.replace(/<m3e-icon style=\{\{ fontSize: '14px' \}\}>terminal<\/m3e-icon>/g, '<Terminal className="w-3.5 h-3.5" />');

// Buttons
code = code.replace(/<m3e-button\s*variant="filled"\s*onClick=\{([^>]*)\}\s*style=\{\{ flex: 1, minWidth: 0 \}\}\s*>\s*Approve\s*<\/m3e-button>/g, '<button onClick={$1} className="flex-1 bg-zinc-100 hover:bg-white text-zinc-950 font-medium py-1.5 rounded-md transition-colors text-xs">Approve</button>');
code = code.replace(/<m3e-button\s*variant="outlined"\s*onClick=\{([^>]*)\}\s*style=\{\{ flex: 1, minWidth: 0 \}\}\s*>\s*Deny\s*<\/m3e-button>/g, '<button onClick={$1} className="flex-1 bg-transparent hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium py-1.5 rounded-md transition-colors text-xs">Deny</button>');

// Input Area
code = code.replace(/<m3e-icon-button onClick=\{\(\) => handleSubmit\(\)\} disabled=\{!input\.trim\(\) \|\| running\}>\s*<m3e-icon style=\{\{ color: input\.trim\(\) && !running \? 'var\(--md-sys-color-primary\)' : 'inherit' \}\}>send<\/m3e-icon>\s*<\/m3e-icon-button>/g, 
  '<button onClick={() => handleSubmit()} disabled={!input.trim() || running} className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-50 transition-colors"><Send className="w-5 h-5" /></button>');

fs.writeFileSync('src/components/AgentPanel.tsx', code);
console.log('done');
