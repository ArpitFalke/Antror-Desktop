import React, { useState, useEffect } from 'react';
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderOpen,
  Save,
  Check,
  Code
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  size?: number;
}

export const ProjectPanel: React.FC = () => {
  const {
    projects,
    refreshProjects
  } = useAppStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  useEffect(() => {
    if (activeProject && window.antrorAPI) {
      setSelectedProjectId(activeProject.id);
      window.antrorAPI.getProjectFiles(activeProject.id).then(tree => {
        setFileTree(tree);
      });
    }
  }, [activeProject]);

  const handleCreateProject = async () => {
    const name = prompt('Enter new project name:');
    if (!name || !window.antrorAPI) return;
    const proj = await window.antrorAPI.createProject(name);
    await refreshProjects();
    setSelectedProjectId(proj.id);
  };

  const handleFileClick = async (node: FileNode) => {
    if (node.isDirectory) {
      const next = new Set(expandedDirs);
      if (next.has(node.path)) next.delete(node.path);
      else next.add(node.path);
      setExpandedDirs(next);
    } else {
      setActiveFile(node.path);
      if (activeProject && window.antrorAPI) {
        const full = `${activeProject.path}/${node.path}`.replace(/\\/g, '/');
        const content = await window.antrorAPI.readFileContent(full);
        setFileContent(content);
        setIsSaved(true);
      }
    }
  };

  const handleSave = async () => {
    if (!activeProject || !activeFile || !window.antrorAPI) return;
    const full = `${activeProject.path}/${activeFile}`.replace(/\\/g, '/');
    await window.antrorAPI.writeFileContent(full, fileContent);
    setIsSaved(true);
  };

  const renderTree = (nodes: FileNode[]) => {
    return (
      <div className="space-y-0.5">
        {nodes.map(node => {
          const isExpanded = expandedDirs.has(node.path);
          const isSelected = activeFile === node.path;

          return (
            <div key={node.path}>
              <div
                onClick={() => handleFileClick(node)}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                  isSelected ? 'bg-antror-800 text-brand-400 font-medium' : 'text-antror-350 hover:bg-antror-850 hover:text-antror-100'
                }`}
              >
                {node.isDirectory ? (
                  <>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-antror-500" /> : <ChevronRight className="w-3.5 h-3.5 text-antror-500" />}
                    <Folder className="w-3.5 h-3.5 text-amber-500/80" />
                  </>
                ) : (
                  <>
                    <span className="w-3.5" />
                    <File className="w-3.5 h-3.5 text-antror-500" />
                  </>
                )}
                <span className="truncate">{node.name}</span>
              </div>

              {node.isDirectory && isExpanded && node.children && (
                <div className="pl-4">
                  {renderTree(node.children)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-antror-950 border-l border-antror-800/80">
      {/* Project Selector Bar */}
      <div className="h-12 border-b border-antror-800/80 px-3 bg-antror-900 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="bg-antror-950 text-xs text-antror-200 border border-antror-800 rounded px-2 py-1 focus:outline-none"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {activeProject && (
            <button
              onClick={() => window.antrorAPI?.showItemInFolder(activeProject.path)}
              className="p-1 text-antror-400 hover:text-antror-200 rounded"
              title="Show in File Explorer"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={handleCreateProject}
          className="flex items-center space-x-1 px-2 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded text-xs transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>New Project</span>
        </button>
      </div>

      {/* Main Workspace Split: Tree + Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tree Sidebar */}
        <div className="w-48 border-r border-antror-800/80 p-2 overflow-y-auto flex-shrink-0">
          <div className="text-[10px] uppercase font-semibold text-antror-500 px-2 mb-2">Files</div>
          {fileTree.length > 0 ? renderTree(fileTree) : (
            <div className="p-2 text-xs text-antror-500">No files yet.</div>
          )}
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-antror-950">
          {activeFile ? (
            <>
              <div className="h-9 border-b border-antror-850 px-3 flex items-center justify-between bg-antror-900/60 text-xs">
                <span className="font-mono text-antror-300">{activeFile}</span>
                <button
                  onClick={handleSave}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs transition-colors ${
                    isSaved ? 'text-antror-500' : 'bg-brand-500 text-white hover:bg-brand-600'
                  }`}
                >
                  {isSaved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>
              </div>

              <textarea
                value={fileContent}
                onChange={e => {
                  setFileContent(e.target.value);
                  setIsSaved(false);
                }}
                className="flex-1 p-3 bg-transparent font-mono text-xs text-antror-200 resize-none focus:outline-none"
              />
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-antror-500">
              <Code className="w-8 h-8 mb-2 opacity-40" />
              <div className="text-xs">Select a file from the tree to edit.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
