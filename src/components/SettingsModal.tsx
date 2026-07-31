import React, { useState } from 'react';
import { 
  Search, Settings, User, Shield, CreditCard, Briefcase, BellRing, Moon, Code,
  Activity, LayoutGrid, Plug, X, ChevronDown, Check, Upload, FileText, Plus
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState('Skills');
  const [skills, setSkills] = useState([
    { name: 'token-meter', updated: '4/13/26', author: 'You' },
    { name: 'caveman', updated: '4/13/26', author: 'You' },
    { name: 'skill-creator', updated: '7/12/26', author: 'Anthropic' },
  ]);
  const [connectors, setConnectors] = useState([
    { name: 'Spotify', type: 'Web Custom', status: 'connected' },
    { name: 'GitHub Integration', type: 'Web', status: 'not_connected' }
  ]);
  const [addSkillDropdown, setAddSkillDropdown] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const [pasteName, setPasteName] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  
  if (!isOpen) return null;

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pasteName && pasteContent) {
      setSkills(prev => [{
        name: pasteName,
        updated: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }),
        author: 'You'
      }, ...prev]);
      setIsPasting(false);
      setPasteName('');
      setPasteContent('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newSkills = Array.from(files).map(file => ({
        name: file.name.replace('.md', ''),
        updated: new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }),
        author: 'You'
      }));
      setSkills(prev => [...newSkills, ...prev]);
    }
  };

  const renderSidebarItem = (icon: React.ElementType, label: string) => {
    const isActive = activeTab === label;
    return (
      <button 
        onClick={() => setActiveTab(label)}
        className={`flex items-center gap-2 sm:gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive 
            ? 'bg-[var(--color-app-surfaceHover)] text-[var(--color-app-textPrimary)]' 
            : 'text-[var(--color-app-textSecondary)] hover:text-[var(--color-app-textPrimary)] hover:bg-[var(--color-app-surfaceHover)]/50'
        }`}
      >
        {React.createElement(icon, { className: "w-[18px] h-[18px]" })}
        {label}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[var(--color-app-main)] border border-[var(--color-app-border)] rounded-2xl w-full max-w-[1000px] h-[85dvh] sm:h-[75vh] min-h-0 flex overflow-hidden shadow-2xl">
        
        {/* Sidebar */}
        <div className="hidden sm:flex sm:w-[240px] border-r border-[var(--color-app-border)] flex flex-col bg-[var(--color-app-surface)] shrink-0">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-app-textMuted)]" />
              <input 
                type="text" 
                placeholder="Search" 
                className="w-full bg-[var(--color-app-surfaceHover)] border-none rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--color-app-textPrimary)] placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
            <div className="mb-6">
              <div className="px-3 mb-2 text-xs font-semibold text-[var(--color-app-textMuted)] tracking-wider">Settings</div>
              <div className="space-y-0.5">
                {renderSidebarItem(Settings, 'General')}
                {renderSidebarItem(User, 'Account')}
                {renderSidebarItem(Shield, 'Privacy')}
                {renderSidebarItem(CreditCard, 'Billing')}
                {renderSidebarItem(Briefcase, 'Capabilities')}
                {renderSidebarItem(BellRing, 'Reflect')}
                {renderSidebarItem(Moon, 'Time and focus')}
                {renderSidebarItem(Code, 'Claude Code')}
              </div>
            </div>
            
            <div>
              <div className="px-3 mb-2 text-xs font-semibold text-[var(--color-app-textMuted)] tracking-wider">Customize</div>
              <div className="space-y-0.5">
                {renderSidebarItem(Activity, 'Skills')}
                {renderSidebarItem(LayoutGrid, 'Connectors')}
                {renderSidebarItem(Plug, 'Plugins')}
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[var(--color-app-main)] overflow-hidden relative">
          {/* Header */}
          <div className="min-h-16 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 border-b border-transparent shrink-0 mt-2">
            <h1 className="text-xl font-medium text-[var(--color-app-textPrimary)]">{activeTab}</h1>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <button className="text-[var(--color-app-textSecondary)] hover:text-[var(--color-app-textPrimary)] p-2">
                <Search className="w-5 h-5" />
              </button>
              
              {activeTab === 'Skills' && (
                <>
                  <button className="px-4 py-1.5 bg-[var(--color-app-surfaceHover)] hover:bg-[var(--color-app-borderLight)] text-[var(--color-app-textPrimary)] text-sm font-medium rounded-lg transition-colors border border-[var(--color-app-borderLight)]">
                    Browse
                  </button>
                  <div className="relative">
                    <button 
                      onClick={() => setAddSkillDropdown(!addSkillDropdown)}
                      className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-app-borderLight)] hover:bg-[var(--color-app-border)] text-[var(--color-app-textPrimary)] text-sm font-medium rounded-lg transition-colors border border-[var(--color-app-borderLight)]"
                    >
                      Add <ChevronDown className="w-4 h-4" />
                    </button>
                    {addSkillDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--color-app-surfaceHover)] border border-[var(--color-app-borderLight)] rounded-lg shadow-xl overflow-hidden z-20">
                        <label className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-[var(--color-app-textPrimary)] hover:bg-[var(--color-app-borderLight)] transition-colors cursor-pointer">
                          <Upload className="w-4 h-4 text-[var(--color-app-textSecondary)]" />
                          Upload files
                          <input 
                            type="file" 
                            multiple 
                            accept=".md,.txt" 
                            className="hidden" 
                            onChange={(e) => {
                              handleFileUpload(e);
                              setAddSkillDropdown(false);
                            }}
                          />
                        </label>
                        <button 
                          className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-[var(--color-app-textPrimary)] hover:bg-[var(--color-app-borderLight)] transition-colors"
                          onClick={() => {
                            setIsPasting(true);
                            setAddSkillDropdown(false);
                          }}
                        >
                          <FileText className="w-4 h-4 text-[var(--color-app-textSecondary)]" />
                          Paste content
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'Connectors' && (
                <button className="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-app-borderLight)] hover:bg-[var(--color-app-border)] text-[var(--color-app-textPrimary)] text-sm font-medium rounded-lg transition-colors border border-[var(--color-app-borderLight)]">
                  Add <ChevronDown className="w-4 h-4" />
                </button>
              )}

              <button onClick={onClose} className="text-[var(--color-app-textSecondary)] hover:text-[var(--color-app-textPrimary)] ml-2">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
            {isPasting ? (
              <form onSubmit={handlePasteSubmit} className="max-w-2xl mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <h2 className="text-lg font-medium text-[var(--color-app-textPrimary)] mb-4">Add Skill from Content</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-app-textSecondary)] mb-1">Skill Name</label>
                    <input 
                      type="text"
                      required
                      value={pasteName}
                      onChange={(e) => setPasteName(e.target.value)}
                      className="w-full bg-[var(--color-app-surfaceHover)] border border-[var(--color-app-borderLight)] rounded-lg px-4 py-2.5 text-[var(--color-app-textPrimary)] focus:outline-none focus:border-zinc-500"
                      placeholder="e.g. database-utils"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-app-textSecondary)] mb-1">Skill Instructions (Markdown)</label>
                    <textarea 
                      required
                      value={pasteContent}
                      onChange={(e) => setPasteContent(e.target.value)}
                      className="w-full bg-[var(--color-app-surfaceHover)] border border-[var(--color-app-borderLight)] rounded-lg px-4 py-3 text-[var(--color-app-textPrimary)] focus:outline-none focus:border-zinc-500 min-h-[200px] resize-y font-mono text-sm"
                      placeholder="# Instructions..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsPasting(false)}
                      className="px-4 py-2 bg-transparent text-[var(--color-app-textSecondary)] font-medium rounded-lg hover:bg-[var(--color-app-surfaceHover)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-zinc-100 text-zinc-950 font-medium rounded-lg hover:bg-white transition-colors"
                    >
                      Save Skill
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <>
                {activeTab === 'Skills' && (
                  <div className="mt-4">
                    <div className="grid grid-cols-[minmax(0,2fr),minmax(5rem,1fr),minmax(4rem,1fr)] gap-3 sm:gap-4 px-4 py-3 border-b border-[var(--color-app-border)] text-sm font-medium text-[var(--color-app-textSecondary)]">
                      <div>Skill</div>
                      <div>Last updated</div>
                      <div>Author</div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {skills.map((skill, idx) => (
                        <div key={idx} className="grid grid-cols-[minmax(0,2fr),minmax(5rem,1fr),minmax(4rem,1fr)] gap-3 sm:gap-4 px-4 py-3 hover:bg-[var(--color-app-surfaceHover)]/50 rounded-xl transition-colors items-center text-sm">
                          <div className="text-[var(--color-app-textPrimary)] font-medium">{skill.name}</div>
                          <div className="text-[var(--color-app-textSecondary)]">{skill.updated}</div>
                          <div className="text-[var(--color-app-textSecondary)]">{skill.author}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {activeTab === 'Connectors' && (
                  <div className="mt-2">
                    <div className="flex gap-6 border-b border-[var(--color-app-border)] mb-6">
                      {['All', 'Connected', 'Not connected'].map(tab => (
                        <button 
                          key={tab} 
                          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${tab === 'All' ? 'border-zinc-200 text-[var(--color-app-textPrimary)]' : 'border-transparent text-[var(--color-app-textSecondary)] hover:text-[var(--color-app-textSecondary)]'}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    
                    <div className="mb-8">
                      <h3 className="text-xs font-semibold text-[var(--color-app-textMuted)] tracking-wider uppercase mb-4">Popular</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {['Gmail', 'Google Drive', 'Slack'].map(app => (
                          <div key={app} className="bg-[var(--color-app-surfaceHover)]/40 border border-[var(--color-app-border)] rounded-xl p-4 flex items-center justify-between hover:bg-[var(--color-app-surfaceHover)] transition-colors cursor-pointer">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                                {/* Placeholders for logos */}
                                <div className="w-4 h-4 bg-gradient-to-br from-blue-400 to-purple-500 rounded-[2px]" />
                              </div>
                              <span className="font-medium text-[var(--color-app-textPrimary)] text-sm">{app}</span>
                            </div>
                            <button className="px-3 py-1.5 bg-[var(--color-app-borderLight)] hover:bg-[var(--color-app-border)] text-[var(--color-app-textPrimary)] text-xs font-medium rounded-lg transition-colors border border-[var(--color-app-borderLight)]">
                              Connect
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="grid grid-cols-[minmax(0,2fr),minmax(5rem,1fr),minmax(4rem,1fr)] gap-3 sm:gap-4 px-4 py-3 border-b border-[var(--color-app-border)] text-sm font-medium text-[var(--color-app-textSecondary)]">
                        <div>Connector</div>
                        <div>Type</div>
                        <div>Status</div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {connectors.map((c, idx) => (
                          <div key={idx} className="grid grid-cols-[minmax(0,2fr),minmax(5rem,1fr),minmax(4rem,1fr)] gap-3 sm:gap-4 px-4 py-4 hover:bg-[var(--color-app-surfaceHover)]/50 rounded-xl transition-colors items-center text-sm">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-[var(--color-app-textSecondary)]">
                                {c.name.charAt(0)}
                              </div>
                              <span className="text-[var(--color-app-textPrimary)] font-medium">{c.name}</span>
                            </div>
                            <div className="text-[var(--color-app-textSecondary)] flex items-center gap-2">
                              {c.type.includes('Web') && <span>Web</span>}
                              {c.type.includes('Custom') && <span className="px-1.5 py-0.5 bg-zinc-800 text-[var(--color-app-textSecondary)] text-[10px] rounded uppercase font-bold">Custom</span>}
                            </div>
                            <div>
                              {c.status === 'connected' ? (
                                <Check className="w-5 h-5 text-[var(--color-app-textSecondary)]" />
                              ) : (
                                <button className="px-3 py-1.5 bg-[var(--color-app-borderLight)] hover:bg-[var(--color-app-border)] text-[var(--color-app-textPrimary)] text-xs font-medium rounded-lg transition-colors border border-[var(--color-app-borderLight)]">
                                  Connect
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {activeTab !== 'Skills' && activeTab !== 'Connectors' && (
                  <div className="flex items-center justify-center h-full text-[var(--color-app-textMuted)]">
                    <p>{activeTab} settings coming soon...</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
