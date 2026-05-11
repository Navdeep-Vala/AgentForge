import { exec } from 'child_process';
import { promisify } from 'util';
import { WorkspaceManager } from './workspace.manager';

const execAsync = promisify(exec);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CommandService {
  private readonly allowedCommands = [
    'npm', 'npx', 'node', 'git', 'ls', 'cat', 'grep', 'find', 'mkdir', 'touch', 'rm', 'cp', 'mv',
    'python3', 'python', 'pip3', 'pip', 'curl', 'wget', 'unzip', 'tar',
  ];

  constructor(private workspace: WorkspaceManager) {}

  async runCommand(command: string, timeout = 60000): Promise<CommandResult> {
    const baseCommand = command.split(' ')[0];
    
    if (!this.allowedCommands.includes(baseCommand)) {
      throw new Error(`Command '${baseCommand}' is not allowed. Allowed commands: ${this.allowedCommands.join(', ')}`);
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspace.getRootDir(),
        timeout,
        env: { ...process.env, CI: 'true' }
      });
      
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.code || 1
      };
    }
  }
}
