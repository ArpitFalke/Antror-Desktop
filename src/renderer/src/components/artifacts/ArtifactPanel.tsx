import React, { useState, useEffect, useRef } from 'react';
import {
  Code,
  Eye,
  Copy,
  Check,
  Download,
  FolderPlus,
  RefreshCw,
  Layers
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const ArtifactPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [mermaidSvg, setMermaidSvg] = useState<string>('');
  const mermaidRef = useRef<HTMLDivElement>(null);

  const {
    currentArtifact,
    artifactsList,
    projects,
    selectArtifact
  } = useAppStore();

  const handleCopy = () => {
    if (currentArtifact) {
      navigator.clipboard.writeText(currentArtifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!currentArtifact) return;
    const blob = new Blob([currentArtifact.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentArtifact.title.replace(/\s+/g, '_')}.${currentArtifact.language || 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveToProject = async () => {
    if (!currentArtifact || projects.length === 0 || !window.antrorAPI) return;
    const project = projects[0];
    const filename = `${currentArtifact.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${currentArtifact.language || 'txt'}`;
    try {
      await window.antrorAPI.saveArtifactToProject(currentArtifact.id, project.id, filename);
      alert(`Artifact saved to project: ${project.name}/${filename}`);
    } catch (e: any) {
      alert(`Failed to save: ${e.message}`);
    }
  };

  // Dynamically render Mermaid diagrams on demand
  useEffect(() => {
    if (currentArtifact?.type === 'mermaid') {
      import('mermaid')
        .then(({ default: m }) => {
          m.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });
          const renderId = `mermaid-${Date.now()}`;
          return m.render(renderId, currentArtifact.content);
        })
        .then(result => {
          setMermaidSvg(result.svg);
        })
        .catch(err => {
          console.error('Mermaid render error:', err);
          setMermaidSvg(`<div class="p-4 text-rose-400 text-xs font-mono">Mermaid Syntax Error: ${err.message}</div>`);
        });
    }
  }, [currentArtifact]);

  if (!currentArtifact) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-antror-500">
        <Layers className="w-10 h-10 mb-3 opacity-40" />
        <div className="text-sm font-medium text-antror-300 mb-1">No Artifact Selected</div>
        <p className="text-xs max-w-xs">
          Code, HTML, React, SVG, and Mermaid diagrams generated during chats will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-antror-900 border-l border-antror-800/80">
      {/* Top Header */}
      <div className="h-12 border-b border-antror-800/80 px-4 flex items-center justify-between bg-antror-950 flex-shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="px-2 py-0.5 bg-brand-500/20 text-brand-400 text-[10px] font-mono rounded font-semibold uppercase">
            {currentArtifact.type}
          </span>
          <span className="text-xs font-medium text-antror-200 truncate max-w-[180px]">
            {currentArtifact.title}
          </span>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex items-center space-x-1.5">
          <div className="flex p-0.5 bg-antror-900 border border-antror-800 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors ${
                activeTab === 'preview' ? 'bg-antror-800 text-antror-100 font-medium' : 'text-antror-400 hover:text-antror-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-colors ${
                activeTab === 'code' ? 'bg-antror-800 text-antror-100 font-medium' : 'text-antror-400 hover:text-antror-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          <div className="h-4 w-px bg-antror-800 mx-1" />

          <button
            onClick={handleCopy}
            className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-850 rounded-lg transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleDownload}
            className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-850 rounded-lg transition-colors"
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </button>

          {projects.length > 0 && (
            <button
              onClick={handleSaveToProject}
              className="p-1.5 text-antror-400 hover:text-antror-200 hover:bg-antror-850 rounded-lg transition-colors"
              title="Save to Project"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Preview / Code Viewport */}
      <div className="flex-1 overflow-auto bg-antror-950">
        {activeTab === 'preview' ? (
          <div className="h-full w-full">
            {currentArtifact.type === 'mermaid' ? (
              <div
                ref={mermaidRef}
                className="h-full flex items-center justify-center p-6 overflow-auto"
                dangerouslySetInnerHTML={{ __html: mermaidSvg }}
              />
            ) : currentArtifact.type === 'svg' ? (
              <div
                className="h-full flex items-center justify-center p-6 overflow-auto"
                dangerouslySetInnerHTML={{ __html: currentArtifact.content }}
              />
            ) : currentArtifact.type === 'html' || currentArtifact.type === 'react' ? (
              <iframe
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta charset="utf-8" />
                      <script src="https://cdn.tailwindcss.com"></script>
                      <style>body { margin: 0; background: #0f0f0e; color: #f5f5f5; font-family: sans-serif; padding: 1rem; }</style>
                    </head>
                    <body>
                      ${currentArtifact.content}
                    </body>
                  </html>
                `}
                title="Artifact Preview"
                sandbox="allow-scripts"
                className="w-full h-full border-none bg-antror-950"
              />
            ) : (
              <pre className="p-4 text-xs font-mono text-antror-300 whitespace-pre-wrap">
                {currentArtifact.content}
              </pre>
            )}
          </div>
        ) : (
          <div className="h-full p-4 overflow-auto">
            <pre className="font-mono text-xs text-antror-200 leading-relaxed">
              <code>{currentArtifact.content}</code>
            </pre>
          </div>
        )}
      </div>

      {/* Artifacts History bar if multiple */}
      {artifactsList.length > 1 && (
        <div className="h-9 border-t border-antror-850/80 px-3 bg-antror-950 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="text-[10px] text-antror-500 uppercase font-semibold">Artifacts:</span>
          {artifactsList.map(a => (
            <button
              key={a.id}
              onClick={() => selectArtifact(a)}
              className={`px-2 py-0.5 rounded text-[11px] truncate max-w-[120px] transition-colors ${
                a.id === currentArtifact.id ? 'bg-brand-500/20 text-brand-400 font-medium' : 'text-antror-400 hover:text-antror-200'
              }`}
            >
              {a.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
