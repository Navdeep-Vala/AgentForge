import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const realpath = promisify(fs.realpath);

export class WorkspaceManager {
  private readonly rootDir: string;

  constructor(workspaceDir: string) {
    if (!workspaceDir) {
      throw new Error('Workspace directory is required');
    }
    // Resolve to absolute path
    this.rootDir = path.resolve(workspaceDir);
    
    // Ensure it exists
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }
    
    // Get real path to prevent symlink escapes
    this.rootDir = fs.realpathSync(this.rootDir);
  }

  /**
   * Ensures a path is within the workspace. Throws if escape detected.
   */
  public resolveSafePath(relativePath: string): string {
    const resolved = path.resolve(this.rootDir, relativePath);
    
    // Check if the resolved path starts with the root directory
    // We use path.relative to see if it's outside
    const relative = path.relative(this.rootDir, resolved);
    
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Path escape detected: ${relativePath} is outside of ${this.rootDir}`);
    }
    
    return resolved;
  }

  public getRootDir(): string {
    return this.rootDir;
  }

  /**
   * Get workspace structure (tree) for initial LLM context
   */
  public async getProjectTree(maxDepth = 3): Promise<string> {
    const tree: string[] = [];
    
    const walk = (dir: string, depth: number) => {
      if (depth > maxDepth) return;
      
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        const indent = '  '.repeat(depth);
        
        if (stats.isDirectory()) {
          tree.push(`${indent}${file}/`);
          walk(fullPath, depth + 1);
        } else {
          tree.push(`${indent}${file}`);
        }
      }
    };

    try {
      walk(this.rootDir, 0);
    } catch (err) {
      return `Error reading project tree: ${(err as Error).message}`;
    }

    return tree.join('\n');
  }
}
