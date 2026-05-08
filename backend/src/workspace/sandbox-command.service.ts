import { DockerService } from '../sandbox/docker.service';
import { WorkspaceManager } from './workspace.manager';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class SandboxCommandService {
  private readonly allowedCommands = [
    'npm', 'npx', 'node', 'git', 'ls', 'cat', 'grep', 'find', 'mkdir', 'touch', 'rm', 'cp', 'mv'
  ];

  constructor(
    private docker: DockerService,
    private containerId: string
  ) {}

  async runCommand(command: string, timeout = 60000): Promise<CommandResult> {
    const baseCommand = command.split(' ')[0];
    
    if (!this.allowedCommands.includes(baseCommand)) {
      throw new Error(`Command '${baseCommand}' is not allowed. Allowed commands: ${this.allowedCommands.join(', ')}`);
    }

    // Split command into args (naive split — improve with proper shell parsing)
    const args = command.split(' ').filter(Boolean);

    // Docker exec with timeout
    return new Promise((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let timedOut = false;

      this.docker.executeCommand(this.containerId, args, { timeout })
        .then(result => {
          resolve(result);
        })
        .catch(err => {
          reject(err);
        });
    });
  }
}