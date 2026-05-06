import fs from 'fs/promises';
import path from 'path';
import { WorkspaceManager } from './workspace.manager';

export class FileService {
  constructor(private workspace: WorkspaceManager) {}

  async readFile(relativePath: string, startLine?: number, endLine?: number): Promise<string> {
    const safePath = this.workspace.resolveSafePath(relativePath);
    const content = await fs.readFile(safePath, 'utf-8');
    
    if (startLine !== undefined || endLine !== undefined) {
      const lines = content.split('\n');
      const start = startLine ? Math.max(0, startLine - 1) : 0;
      const end = endLine ? Math.min(lines.length, endLine) : lines.length;
      return lines.slice(start, end).join('\n');
    }
    
    return content;
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const safePath = this.workspace.resolveSafePath(relativePath);
    const dir = path.dirname(safePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(safePath, content, 'utf-8');
  }

  async listDirectory(relativePath: string, recursive = false): Promise<string[]> {
    const safePath = this.workspace.resolveSafePath(relativePath);
    
    if (recursive) {
      const results: string[] = [];
      const walk = async (dir: string) => {
        const files = await fs.readdir(dir, { withFileTypes: true });
        for (const file of files) {
          const res = path.resolve(dir, file.name);
          const rel = path.relative(this.workspace.getRootDir(), res);
          if (file.isDirectory()) {
            if (file.name === 'node_modules' || file.name === '.git') continue;
            results.push(rel + '/');
            await walk(res);
          } else {
            results.push(rel);
          }
        }
      };
      await walk(safePath);
      return results;
    } else {
      const files = await fs.readdir(safePath);
      return files;
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    const safePath = this.workspace.resolveSafePath(relativePath);
    await fs.unlink(safePath);
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      const safePath = this.workspace.resolveSafePath(relativePath);
      await fs.access(safePath);
      return true;
    } catch {
      return false;
    }
  }
}
