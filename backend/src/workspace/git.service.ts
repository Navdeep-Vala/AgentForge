import { DockerService } from '../sandbox/docker.service';

export interface GitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitService {
  constructor(
    private docker: DockerService,
    private containerId: string
  ) {}

  async clone(
    repoUrl: string,
    targetDir: string = '/workspace',
    branch?: string
  ): Promise<GitResult> {
    const args = ['git', 'clone'];
    if (branch) args.push('-b', branch);
    args.push(repoUrl, targetDir);
    return this.exec(args);
  }

  private async exec(args: string[]): Promise<GitResult> {
    return this.docker.executeCommand(this.containerId, args);
  }

  async status(cwd: string = '/workspace'): Promise<GitResult> {
    return this.exec(['-C', cwd, 'status', '--porcelain']);
  }

  async diff(cwd: string = '/workspace', filePath?: string): Promise<GitResult> {
    const cmd = ['-C', cwd, 'diff'];
    if (filePath) cmd.push(filePath);
    return this.exec(cmd);
  }

  async diffStaged(cwd: string = '/workspace'): Promise<GitResult> {
    return this.exec(['-C', cwd, 'diff', '--cached']);
  }

  async add(paths: string[], cwd: string = '/workspace'): Promise<GitResult> {
    return this.exec(['-C', cwd, 'add', ...paths]);
  }

  async commit(
    message: string,
    cwd: string = '/workspace',
    authorName: string = 'AgentForge',
    authorEmail: string = 'agent@agentforge.local'
  ): Promise<GitResult> {
    const env = {
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_COMMITTER_NAME: authorName,
      GIT_COMMITTER_EMAIL: authorEmail,
    };
    return this.docker.executeCommand(this.containerId, ['-C', cwd, 'commit', '-m', message], { env });
  }

  async log(cwd: string = '/workspace', limit: number = 10): Promise<GitResult> {
    return this.exec(['-C', cwd, 'log', '--oneline', `-n=${limit}`]);
  }

  async currentBranch(cwd: string = '/workspace'): Promise<string> {
    const result = await this.exec(['-C', cwd, 'branch', '--show-current']);
    return result.stdout.trim();
  }

  async isRepo(cwd: string = '/workspace'): Promise<boolean> {
    const result = await this.exec(['-C', cwd, 'rev-parse', '--is-inside-work-tree']);
    return result.stdout.trim() === 'true';
  }

  async init(cwd: string = '/workspace'): Promise<GitResult> {
    return this.exec(['-C', cwd, 'init']);
  }
}