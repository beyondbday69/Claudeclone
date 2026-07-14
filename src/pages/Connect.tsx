import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Octokit } from '@octokit/rest';
import { Github, Loader2 } from 'lucide-react';

export default function Connect() {
  const [token, setToken] = useState('');
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/env')
      .then(res => res.json())
      .then(data => {
        if (data.githubToken && !token) {
          setToken(data.githubToken);
        }
      })
      .catch(console.error);
  }, []);

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    
    try {
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 50
      });
      setRepos(data);
      localStorage.setItem('github_token', token);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const selectRepo = (owner: string, repo: string) => {
    navigate(`/workspace/${owner}/${repo}`);
  };

  return (
    <div className="min-h-dvh bg-[var(--color-app-main)] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-[var(--color-app-surface)] border border-[var(--color-app-border)] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-[var(--color-app-textPrimary)]">
          <Github className="w-7 h-7" />
          <h1 className="text-2xl font-medium m-0">Connect GitHub</h1>
        </div>
        
        <p className="text-sm text-[var(--color-app-textSecondary)] mb-6">
          Provide a Personal Access Token (PAT) with repo scope to access your repositories.
          The token is stored locally in your browser.
        </p>
        
        {repos.length === 0 ? (
          <form onSubmit={handleConnect} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full px-4 py-3 bg-[var(--color-app-surfaceHover)] border border-[var(--color-app-borderLight)] focus:border-[var(--color-app-accent)] rounded-lg outline-none text-[var(--color-app-textPrimary)] transition-colors"
                required
              />
            </div>
            
            <div className="flex justify-end gap-3 mt-2">
              <button 
                type="button" 
                onClick={() => navigate('/chat')}
                className="px-6 py-2.5 bg-[var(--color-app-surfaceHover)] text-[var(--color-app-textSecondary)] font-medium rounded-lg hover:bg-[var(--color-app-border)] transition-colors"
              >
                Skip to Chat
              </button>
              <button 
                type="submit" 
                disabled={loading || !token}
                className="px-6 py-2.5 bg-[var(--color-app-textPrimary)] text-[var(--color-app-main)] font-medium rounded-lg hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Connect
              </button>
            </div>
            
            {error && (
              <div className="p-3 bg-red-950/50 border border-red-900/50 text-red-400 rounded-lg text-sm mt-2">
                {error}
              </div>
            )}
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-[var(--color-app-textSecondary)] mb-2">Select a Repository</h2>
            <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1 pr-2 custom-scrollbar">
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  onClick={() => selectRepo(repo.owner.login, repo.name)}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-[var(--color-app-surfaceHover)] cursor-pointer transition-colors border border-transparent hover:border-[var(--color-app-borderLight)]"
                >
                  <div className="font-medium text-[var(--color-app-textPrimary)]">{repo.name}</div>
                  <div className="text-xs text-[var(--color-app-textMuted)] mt-1">{repo.owner.login}</div>
                </div>
              ))}
            </div>
            <div className="h-px bg-[var(--color-app-surfaceHover)] my-4" />
            <button 
              type="button"
              onClick={() => setRepos([])}
              className="text-[var(--color-app-textSecondary)] hover:text-[var(--color-app-textPrimary)] text-sm font-medium transition-colors text-left"
            >
              Use a different token
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
