import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Octokit } from '@octokit/rest';
import { ArrowLeft, GitBranch, Settings, FileText, Code2, Plus } from 'lucide-react';
import FileTree from '../components/FileTree';
import Editor from '../components/Editor';
import AgentPanel from '../components/AgentPanel';
import SettingsModal from '../components/SettingsModal';

export default function Workspace() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [octokit, setOctokit] = useState<Octokit | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [branch, setBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('github_token');
    if (!savedToken) {
      navigate('/connect');
      return;
    }
    setToken(savedToken);
    setOctokit(new Octokit({ auth: savedToken }));

    const fetchRepoInfo = async () => {
      try {
        const octo = new Octokit({ auth: savedToken });
        const { data } = await octo.repos.get({ owner: owner!, repo: repo! });
        setBranch(data.default_branch);
        
        try {
          const branchesData = await octo.repos.listBranches({ owner: owner!, repo: repo! });
          setBranches(branchesData.data.map(b => b.name));
        } catch (branchErr) {
          console.error("Failed to list branches:", branchErr);
          setBranches([data.default_branch]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (owner && repo) {
      fetchRepoInfo();
    }
  }, [navigate, owner, repo]);

  const handleFileSelect = async (path: string) => {
    if (!octokit || !owner || !repo) return;
    
    setSelectedFile(path);
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });
      
      if ('content' in data && data.type === 'file') {
        const content = atob(data.content);
        setFileContent(content);
      }
    } catch (err) {
      console.error("Failed to read file", err);
      setFileContent('// Failed to read file or file is not a text file');
    }
  };

  if (!octokit || !owner || !repo) return <div className="p-8 text-[var(--color-app-textMuted)] bg-[var(--color-app-main)] h-dvh flex items-center justify-center">Loading workspace...</div>;

  return (
    <div className="flex h-dvh bg-[var(--color-app-main)] text-[var(--color-app-textPrimary)] overflow-hidden font-sans selection:bg-[#444]">
      {/* Left panel - Sidebar */}
      <div className="w-[260px] h-full flex flex-col bg-[var(--color-app-surface)] shrink-0 border-r border-[var(--color-app-borderLight)]">
        <div className="p-4">
           <button 
             onClick={() => navigate('/connect')}
             className="flex items-center justify-between text-sm font-medium hover:bg-[var(--color-app-borderLight)] px-3 py-2.5 rounded-xl transition-colors w-full bg-[var(--color-app-surfaceHover)] text-[var(--color-app-textPrimary)] group"
           >
              <div className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-[var(--color-app-textMuted)] group-hover:text-[var(--color-app-textPrimary)] transition-colors" />
                <span>Change Repo</span>
              </div>
              <Plus className="w-4 h-4 text-[var(--color-app-textMuted)] group-hover:text-[var(--color-app-textPrimary)] transition-colors" />
           </button>
        </div>
        
        <div className="px-4 pb-2">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-app-surfaceHover)] border border-[var(--color-app-borderLight)] text-[var(--color-app-textSecondary)] rounded-xl text-xs relative group w-full hover:border-[var(--color-app-borderLight)] transition-colors">
              <GitBranch className="w-4 h-4 text-[var(--color-app-textMuted)]" />
              <select
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setSelectedFile(null);
                  setFileContent('');
                }}
                className="bg-transparent appearance-none outline-none cursor-pointer tracking-wide w-full pr-4 text-[var(--color-app-textPrimary)]"
              >
                {branches.length > 0 ? branches.map(b => (
                  <option key={b} value={b} className="bg-[var(--color-app-surface)]">{b}</option>
                )) : (
                  <option value={branch} className="bg-[var(--color-app-surface)]">{branch}</option>
                )}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
        </div>

        <div className="px-4 py-3 mt-2 text-[12px] font-semibold text-[var(--color-app-textMuted)] tracking-wider uppercase">
          Explorer
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
          <FileTree 
             octokit={octokit}
             owner={owner}
             repo={repo}
             branch={branch}
             onSelectFile={handleFileSelect}
             selectedPath={selectedFile}
          />
        </div>
        
        <div className="p-4 border-t border-[var(--color-app-borderLight)] hover:bg-[var(--color-app-surfaceHover)] cursor-pointer transition-colors" onClick={() => setIsSettingsOpen(true)}>
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-[var(--color-app-accent)] flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white font-medium text-sm">{owner.charAt(0).toUpperCase()}</span>
             </div>
             <div className="text-sm font-medium text-[var(--color-app-textPrimary)] truncate flex-1">
               {owner}/{repo}
             </div>
             <Settings className="w-4 h-4 text-[var(--color-app-textMuted)]" />
           </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--color-app-main)]">
        <div className="flex-1 flex overflow-hidden">
           {/* Editor if file selected */}
           {selectedFile && (
              <div className="flex-1 flex flex-col h-full bg-[var(--color-app-surface)] border-r border-[var(--color-app-borderLight)]">
                <div className="h-14 border-b border-[var(--color-app-borderLight)] flex items-center px-4 shrink-0 bg-[var(--color-app-main)]">
                  <FileText className="w-4 h-4 mr-2 text-[var(--color-app-textMuted)]" />
                  <span className="text-sm font-medium text-[var(--color-app-textPrimary)]">{selectedFile}</span>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  <Editor 
                     path={selectedFile} 
                     content={fileContent} 
                     onChange={setFileContent} 
                   />
                </div>
              </div>
           )}
           
           {/* Agent Panel */}
           <div className={`${selectedFile ? 'w-[450px] lg:w-[500px]' : 'flex-1 max-w-4xl mx-auto w-full'} h-full shrink-0 flex flex-col bg-[var(--color-app-main)] transition-all`}>
              <AgentPanel 
                 owner={owner}
                 repo={repo}
                 branch={branch}
                 octokit={octokit}
              />
           </div>
        </div>
      </div>
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </div>
  );
}
