import React, { useState, useEffect } from 'react';
import { LiveProvider, LiveEditor, LiveError, LivePreview } from 'react-live';
import AgentPanel from '../components/AgentPanel';
import Editor from '../components/Editor';
import FileTree from '../components/FileTree';
import SettingsModal from '../components/SettingsModal';

const defaultCode = `
function MistralTextArea() {
  const [input, setInput] = React.useState('');

  return (
    <div className="w-full max-w-3xl mx-auto mt-10">
      <div className="bg-[#27262B] backdrop-blur-md border border-app-border/40 rounded-xl shadow-xl flex items-center gap-2 px-2.5 py-2 focus-within:ring-1 focus-within:ring-app-border/80 focus-within:border-transparent transition-premium">
        
        <button 
            title="Add attachment"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-app-surface/60 hover:bg-app-surface border border-app-border/40 text-app-textMuted hover:text-app-textSecondary rounded-lg transition-premium"
        >
            <i className="ph-light ph-plus text-md"></i>
        </button>

        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          type="text"
          placeholder="Type / for quick access" 
          className="flex-1 bg-transparent text-app-textPrimary placeholder-app-textMuted outline-none text-sm min-w-0" 
        />

        <button 
            disabled={!input.trim()}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-app-accent hover:bg-[#cc3a05] text-white rounded-lg disabled:bg-[#27262B] disabled:text-white transition-premium"
        >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ shapeRendering: "crispEdges" }}>
              <path d="M6 2h2v2H6V2z M4 4h2v2H4V4z M8 4h2v2H8V4z M2 6h2v2H2V6z M10 6h2v2H10V6z M6 4h2v8H6V4z" />
            </svg>
        </button>
      </div>
    </div>
  );
}
`.trim();

const mistralPrismTheme = {
  plain: { color: '#f5f5f5', backgroundColor: '#1c1c1e' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#8a8a8a', fontStyle: 'italic' } },
    { types: ['punctuation'], style: { color: '#a8a8a8' } },
    { types: ['namespace'], style: { opacity: 0.7 } },
    { types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'], style: { color: '#ffb83e' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#fff8e0' } },
    { types: ['operator', 'entity', 'url', 'variable'], style: { color: '#fa520f' } },
    { types: ['atrule', 'attr-value', 'keyword'], style: { color: '#ff8105' } },
    { types: ['function', 'class-name'], style: { color: '#ffd900' } },
    { types: ['regex', 'important'], style: { color: '#ff8105' } },
    { types: ['important', 'bold'], style: { fontWeight: 'bold' } },
    { types: ['italic'], style: { fontStyle: 'italic' } },
  ],
};

function rgbToHex(rgb: string) {
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  return '#' + match.slice(1).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

function VisualToolbar({ node, onClose, onSelectParent }: { node: HTMLElement, onClose: () => void, onSelectParent: () => void }) {
  const [domBg, setDomBg] = useState('#000000');
  const [domColor, setDomColor] = useState('#ffffff');
  const [domRadius, setDomRadius] = useState(0);
  const [domPadding, setDomPadding] = useState(0);

  useEffect(() => {
    const style = window.getComputedStyle(node);
    setDomBg(rgbToHex(style.backgroundColor));
    setDomColor(rgbToHex(style.color));
    setDomRadius(parseInt(style.borderRadius) || 0);
    setDomPadding(parseInt(style.padding) || parseInt(style.paddingTop) || 0);

    // Highlight the selected node
    const originalOutline = node.style.outline;
    const originalOutlineOffset = node.style.outlineOffset;
    const originalTransition = node.style.transition;
    
    node.style.transition = 'outline 0.15s ease-out, outline-offset 0.15s ease-out';
    node.style.outline = '2px solid #fa520f';
    node.style.outlineOffset = '2px';

    return () => {
      node.style.outline = originalOutline;
      node.style.outlineOffset = originalOutlineOffset;
      setTimeout(() => { node.style.transition = originalTransition; }, 150);
    };
  }, [node]);

  const updateNodeStyle = (key: any, value: string) => {
    node.style[key] = value;
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 bg-app-surface/95 backdrop-blur-xl border border-app-border rounded-xl shadow-2xl p-4 z-50 flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center border-b border-app-border/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-app-surfaceHover text-app-textSecondary px-2 py-1 rounded">
            {node.tagName.toLowerCase()}
          </span>
          <span className="text-xs text-app-textMuted truncate max-w-[200px]">
            {node.className}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onSelectParent} 
            className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-app-surfaceHover hover:bg-app-border text-app-textSecondary hover:text-app-textPrimary transition-colors flex items-center gap-1"
            title="Select Parent Element"
          >
            <i className="ph-bold ph-arrow-up"></i> Parent
          </button>
          <button onClick={onClose} className="text-app-textMuted hover:text-app-textPrimary ml-2">
            <i className="ph-bold ph-x"></i>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-app-textMuted">Background</label>
          <div className="flex gap-2">
            <input 
              type="color" value={domBg} 
              onInput={e => { setDomBg((e.target as HTMLInputElement).value); updateNodeStyle('backgroundColor', (e.target as HTMLInputElement).value); }}
              onChange={e => { setDomBg(e.target.value); updateNodeStyle('backgroundColor', e.target.value); }}
              className="w-8 h-8 rounded cursor-pointer border border-app-border bg-transparent"
            />
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-xs text-app-textMuted">Text Color</label>
          <div className="flex gap-2">
            <input 
              type="color" value={domColor} 
              onInput={e => { setDomColor((e.target as HTMLInputElement).value); updateNodeStyle('color', (e.target as HTMLInputElement).value); updateNodeStyle('fill', (e.target as HTMLInputElement).value); }}
              onChange={e => { setDomColor(e.target.value); updateNodeStyle('color', e.target.value); updateNodeStyle('fill', e.target.value); }}
              className="w-8 h-8 rounded cursor-pointer border border-app-border bg-transparent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs text-app-textMuted flex justify-between">
            <span>Radius</span> <span>{domRadius}px</span>
          </label>
          <input 
            type="range" min="0" max="64" value={domRadius} 
            onInput={e => { setDomRadius(Number((e.target as HTMLInputElement).value)); updateNodeStyle('borderRadius', (e.target as HTMLInputElement).value + 'px'); }}
            onChange={e => { setDomRadius(Number(e.target.value)); updateNodeStyle('borderRadius', e.target.value + 'px'); }}
            className="accent-app-accent"
          />
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-xs text-app-textMuted flex justify-between">
            <span>Padding</span> <span>{domPadding}px</span>
          </label>
          <input 
            type="range" min="0" max="64" value={domPadding} 
            onInput={e => { setDomPadding(Number((e.target as HTMLInputElement).value)); updateNodeStyle('padding', (e.target as HTMLInputElement).value + 'px'); }}
            onChange={e => { setDomPadding(Number(e.target.value)); updateNodeStyle('padding', e.target.value + 'px'); }}
            className="accent-app-accent"
          />
        </div>
      </div>
    </div>
  );
}

export default function TextAreaPlayground() {
  const [code, setCode] = useState(defaultCode);
  const [inspectMode, setInspectMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<HTMLElement | null>(null);

  const handlePreviewClick = (e: React.MouseEvent) => {
    if (!inspectMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedNode(e.target as HTMLElement);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-app-main text-app-textPrimary font-sans">
      <header className="px-6 py-4 border-b border-app-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <i className="ph-bold ph-cursor-click text-app-accent text-xl"></i>
          <h1 className="font-serif text-xl font-semibold">Visual DOM Inspector</h1>
        </div>
        <a href="/" className="text-app-textMuted hover:text-app-textPrimary transition-premium text-sm">Back to App</a>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <LiveProvider code={code} scope={{ React, AgentPanel, Editor, FileTree, SettingsModal }} theme={mistralPrismTheme as any}>
          {/* Editor Side */}
          <div className="w-1/2 flex flex-col border-r border-app-border overflow-hidden">
            <div className="bg-[#1c1c1e] px-4 py-2 border-b border-app-border text-xs font-medium text-[#8a8a8a] uppercase tracking-wider">
              Editable Code (React)
            </div>
            <div className="flex-1 overflow-auto bg-[#1c1c1e] text-sm">
              <LiveEditor onChange={setCode} className="font-mono !min-h-full" style={{ outline: 'none' }} />
            </div>
          </div>

          {/* Preview Side */}
          <div className="w-1/2 flex flex-col overflow-hidden bg-app-main relative">
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, var(--color-app-surfaceHover) 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.5 }}></div>
            
            <div className="bg-app-surface px-4 py-2 border-b border-app-border text-xs font-medium text-app-textMuted uppercase tracking-wider flex justify-between items-center relative z-10">
              <span>Live Preview</span>
              <button 
                onClick={() => setInspectMode(!inspectMode)}
                className={`px-3 py-1 rounded-full flex items-center gap-2 transition-all ${inspectMode ? 'bg-app-accent text-white shadow-lg shadow-app-accent/20' : 'bg-app-surfaceHover text-app-textMuted hover:text-app-textPrimary'}`}
              >
                <i className="ph-bold ph-cursor"></i>
                {inspectMode ? 'Inspect Mode ON' : 'Inspect Mode OFF'}
              </button>
            </div>

            <div 
              className={`flex-1 overflow-auto p-8 flex flex-col items-center relative z-10 ${inspectMode ? '*:cursor-crosshair' : ''}`}
              onClickCapture={handlePreviewClick}
            >
              <LiveError className="text-red-400 bg-red-400/10 p-4 rounded-lg font-mono text-sm w-full whitespace-pre-wrap mb-4 border border-red-400/20" />
              <div className="w-full relative pointer-events-auto">
                <LivePreview />
              </div>
            </div>

            {/* Visual Inspector Toolbar */}
            {selectedNode && (
              <VisualToolbar 
                key={selectedNode === window.document.body ? 'body' : Math.random()} 
                node={selectedNode} 
                onClose={() => setSelectedNode(null)} 
                onSelectParent={() => {
                  if (selectedNode.parentElement && selectedNode.parentElement !== window.document.body) {
                    setSelectedNode(selectedNode.parentElement);
                  }
                }}
              />
            )}
          </div>
        </LiveProvider>
      </div>
    </div>
  );
}
