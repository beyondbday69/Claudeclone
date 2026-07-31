import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from './Editor';

interface CanvasProps {
  content: string;
  language: string;
  onClose: () => void;
}

export default function Canvas({ content, language, onClose }: CanvasProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Attempt to give it a sensible default extension
    let ext = 'txt';
    const langLower = language.toLowerCase();
    if (langLower === 'javascript' || langLower === 'js') ext = 'js';
    else if (langLower === 'typescript' || langLower === 'ts') ext = 'ts';
    else if (langLower === 'python' || langLower === 'py') ext = 'py';
    else if (langLower === 'html') ext = 'html';
    else if (langLower === 'css') ext = 'css';
    else if (langLower === 'json') ext = 'json';
    else if (langLower === 'bash' || langLower === 'sh') ext = 'sh';
    else if (langLower) ext = langLower;
    
    a.download = `snippet.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 34, stiffness: 380, mass: 0.85 }}
        className="relative w-full max-w-5xl h-[85vh] bg-[#1e1e1e] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#181818] border-b border-white/10 select-none">
          <div className="flex items-center gap-2 text-app-textMuted font-sans text-sm">
            <i className="ph-fill ph-code block"></i>
            <span className="capitalize">{language || 'Code'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-app-textSecondary hover:text-white hover:bg-white/5 transition-colors"
            >
              {copied ? <i className="ph-bold ph-check text-green-400"></i> : <i className="ph-bold ph-copy"></i>}
              {copied ? 'Copied' : 'Copy'}
            </button>
            
            <button 
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-app-textSecondary hover:text-white hover:bg-white/5 transition-colors"
            >
              <i className="ph-bold ph-download-simple"></i>
              Download
            </button>
            
            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
            
            <button 
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-app-textMuted hover:text-white hover:bg-white/10 transition-colors"
            >
              <i className="ph-bold ph-x text-base"></i>
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div className="flex-1 relative bg-[#1e1e1e]">
          <Editor 
            path={`snippet.${language}`}
            content={content}
            onChange={() => {}}
          />
        </div>
      </motion.div>
    </div>
  );
}
