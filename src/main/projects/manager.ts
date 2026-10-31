import fs from 'fs';
import path from 'path';
import { AppPaths } from '../db/paths';
import { DatabaseService } from '../db';
import { Project } from '../../shared/types';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  size?: number;
}

export class ProjectManager {
  private paths: AppPaths;
  private db: DatabaseService;

  constructor(paths: AppPaths, db: DatabaseService) {
    this.paths = paths;
    this.db = db;
  }

  public getProjects(): Project[] {
    return this.db.getProjects();
  }

  public createProject(name: string, customPath?: string): Project {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const projectDir = customPath || path.join(this.paths.projectsDir, safeName);

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Write initial README if empty
    const readmePath = path.join(projectDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, `# ${name}\n\nProject initialized in Antror Desktop.\n`);
    }

    const project: Project = {
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      path: projectDir,
      instructions: `Context and instructions for project "${name}"`,
      knowledgeFiles: ['README.md'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.db.saveProject(project);
    return project;
  }

  public getProjectFiles(projectId: string): FileNode[] {
    const project = this.db.getProjects().find(p => p.id === projectId);
    if (!project || !fs.existsSync(project.path)) return [];

    return this.scanDir(project.path, project.path);
  }

  private scanDir(dir: string, baseDir: string, depth: number = 0): FileNode[] {
    if (depth > 6) return [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          nodes.push({
            name: entry.name,
            path: relPath,
            isDirectory: true,
            children: this.scanDir(fullPath, baseDir, depth + 1)
          });
        } else {
          const stats = fs.statSync(fullPath);
          nodes.push({
            name: entry.name,
            path: relPath,
            isDirectory: false,
            size: stats.size
          });
        }
      }

      return nodes.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
    } catch {
      return [];
    }
  }

  public readFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  public writeFile(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  public saveArtifactToProject(artifactId: string, projectId: string, filename: string): string {
    const artifact = this.db.getArtifacts().find(a => a.id === artifactId);
    if (!artifact) throw new Error('Artifact not found');

    const project = this.db.getProjects().find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const destPath = path.join(project.path, filename);
    fs.writeFileSync(destPath, artifact.content, 'utf8');
    return destPath;
  }
}
