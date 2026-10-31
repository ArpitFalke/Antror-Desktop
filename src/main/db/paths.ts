import path from 'path';
import os from 'os';
import fs from 'fs';

export class AppPaths {
  public baseDir: string;
  public projectsDir: string;
  public artifactsDir: string;
  public memoryDir: string;
  public logsDir: string;
  public configDir: string;
  public dbPath: string;

  constructor(customBasePath?: string) {
    this.baseDir = customBasePath || path.join(os.homedir(), 'Antror');
    this.projectsDir = path.join(this.baseDir, 'Projects');
    this.artifactsDir = path.join(this.baseDir, 'Artifacts');
    this.memoryDir = path.join(this.baseDir, 'Memory');
    this.logsDir = path.join(this.baseDir, 'Logs');
    this.configDir = path.join(this.baseDir, 'Config');
    this.dbPath = path.join(this.baseDir, 'antror_data.sqlite');
    this.ensureDirs();
  }

  public ensureDirs(): void {
    const dirs = [
      this.baseDir,
      this.projectsDir,
      this.artifactsDir,
      this.memoryDir,
      this.logsDir,
      this.configDir
    ];
    for (const d of dirs) {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    }
  }

  public getPaths() {
    return {
      workspace: this.baseDir,
      projects: this.projectsDir,
      artifacts: this.artifactsDir,
      memory: this.memoryDir,
      logs: this.logsDir,
      config: this.configDir,
      db: this.dbPath
    };
  }
}
