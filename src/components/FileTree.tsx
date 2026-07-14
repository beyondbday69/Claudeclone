import { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';
import clsx from 'clsx';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  type: 'dir' | 'file';
  sha: string;
  children?: FileNode[];
  isOpen?: boolean;
}

interface FileTreeProps {
  octokit: Octokit;
  owner: string;
  repo: string;
  branch: string;
  path?: string;
  onSelectFile: (path: string) => void;
  selectedPath: string | null;
}

export default function FileTree({ octokit, owner, repo, branch, onSelectFile, selectedPath }: FileTreeProps) {
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchRoot = async () => {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: '',
          ref: branch
        });
        
        if (mounted && Array.isArray(data)) {
          const sorted = data.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type as 'dir' | 'file',
            sha: item.sha
          })).sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
          });
          setNodes(sorted);
        }
      } catch (err) {
        console.error("Failed to load root tree", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRoot();
    return () => { mounted = false; };
  }, [octokit, owner, repo, branch]);

  const toggleDir = async (node: FileNode) => {
    if (node.type !== 'dir') {
      onSelectFile(node.path);
      return;
    }

    const updatedNodes = [...nodes];
    const targetNode = findNode(updatedNodes, node.path);
    if (!targetNode) return;

    if (targetNode.isOpen) {
      targetNode.isOpen = false;
      setNodes(updatedNodes);
      return;
    }

    if (!targetNode.children) {
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path: node.path,
          ref: branch
        });
        
        if (Array.isArray(data)) {
          targetNode.children = data.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type as 'dir' | 'file',
            sha: item.sha
          })).sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'dir' ? -1 : 1;
          });
        }
      } catch (err) {
        console.error("Failed to fetch dir", err);
      }
    }
    
    targetNode.isOpen = true;
    setNodes(updatedNodes);
  };

  const findNode = (list: FileNode[], path: string): FileNode | null => {
    for (const n of list) {
      if (n.path === path) return n;
      if (n.children) {
        const found = findNode(n.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  if (loading) {
    return <div className="p-4 text-xs text-[var(--color-app-textMuted)]">Loading tree...</div>;
  }

  const renderNode = (node: FileNode, level = 0) => {
    const isSelected = selectedPath === node.path;
    
    return (
      <div key={node.path}>
        <div 
          className={clsx(
            "flex items-center gap-2 py-2 px-3 mx-2 my-0.5 cursor-pointer text-[13.5px] rounded-lg transition-colors group",
            isSelected ? "bg-[var(--color-app-borderLight)] text-[var(--color-app-textPrimary)] font-medium shadow-sm" : "text-[var(--color-app-textSecondary)] hover:bg-[var(--color-app-surfaceHover)] hover:text-[var(--color-app-textPrimary)]"
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => toggleDir(node)}
        >
          {node.type === 'dir' ? (
            <span className="flex items-center justify-center w-4 h-4 text-[var(--color-app-textMuted)] group-hover:text-[var(--color-app-textPrimary)] transition-colors">
              {node.isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          ) : (
            <span className="w-4 h-4" />
          )}
          
          {node.type === 'dir' ? (
            <span className={node.isOpen ? "text-[var(--color-app-textPrimary)]" : "text-[var(--color-app-textMuted)]"}>
              {node.isOpen ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
            </span>
          ) : (
            <span className="text-[var(--color-app-textMuted)] group-hover:text-[var(--color-app-textMuted)] transition-colors">
              <FileText className="w-4 h-4" />
            </span>
          )}
          
          <span className="truncate">{node.name}</span>
        </div>
        
        {node.isOpen && node.children && (
          <div>
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-2 bg-[var(--color-app-surface)] h-full font-sans">
      {nodes.map(node => renderNode(node))}
    </div>
  );
}
