import MonacoEditor from '@monaco-editor/react';

interface EditorProps {
  path: string;
  content: string;
  onChange: (value: string) => void;
}

const getLanguage = (path: string) => {
  const parts = path.split('/');
  const fileName = parts[parts.length - 1].toLowerCase();
  
  if (fileName === 'dockerfile') return 'dockerfile';
  if (fileName === 'makefile') return 'makefile';
  if (fileName.startsWith('.env')) return 'ini';
  
  const extParts = fileName.split('.');
  const ext = extParts.length > 1 ? extParts.pop() : fileName;

  switch (ext) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': case 'cjs': case 'mjs': return 'javascript';
    case 'json': return 'json';
    case 'html': case 'htm': return 'html';
    case 'css': return 'css';
    case 'scss': return 'scss';
    case 'less': return 'less';
    case 'md': case 'mdx': return 'markdown';
    case 'py': return 'python';
    case 'rs': return 'rust';
    case 'go': return 'go';
    case 'java': return 'java';
    case 'c': case 'h': return 'c';
    case 'cpp': case 'hpp': case 'cc': case 'cxx': return 'cpp';
    case 'cs': return 'csharp';
    case 'php': return 'php';
    case 'rb': return 'ruby';
    case 'sh': case 'bash': case 'zsh': return 'shell';
    case 'yaml': case 'yml': return 'yaml';
    case 'xml': case 'svg': return 'xml';
    case 'sql': return 'sql';
    case 'graphql': case 'gql': return 'graphql';
    case 'vue': return 'vue';
    case 'swift': return 'swift';
    case 'kt': case 'kts': return 'kotlin';
    default: return 'plaintext';
  }
};

export default function Editor({ path, content, onChange }: EditorProps) {
  return (
    <MonacoEditor
      height="100%"
      language={getLanguage(path)}
      theme="vs-dark"
      value={content}
      path={path}
      onChange={(val) => onChange(val ?? '')}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: 'JetBrains Mono, monospace',
        lineHeight: 1.5,
        padding: { top: 16 },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        renderLineHighlight: 'all',
      }}
    />
  );
}
