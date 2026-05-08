import { FileService } from './file.service';
import { CommandService } from './command.service';
import { GitService } from './git.service';

export interface ToolResult {
  success: boolean;
  output: string;
}

export class ToolExecutor {
  constructor(
    private fileService: FileService,
    private commandService: CommandService,
    private gitService?: GitService
  ) {}

  async execute(toolName: string, args: any): Promise<ToolResult> {
    try {
      switch (toolName) {
        // File operations
        case 'read_file':
          const content = await this.fileService.readFile(args.path, args.start_line, args.end_line);
          return { success: true, output: content };
        
        case 'write_file':
          await this.fileService.writeFile(args.path, args.content);
          return { success: true, output: `File ${args.path} written successfully.` };
        
        case 'list_directory':
          const files = await this.fileService.listDirectory(args.path, args.recursive);
          return { success: true, output: files.join('\n') };
        
        case 'delete_file':
          await this.fileService.deleteFile(args.path);
          return { success: true, output: `File ${args.path} deleted.` };
        
        case 'file_exists':
          const exists = await this.fileService.exists(args.path);
          return { success: true, output: exists ? 'exists' : 'not found' };
        
        // Command execution
        case 'run_command':
          const cmdResult = await this.commandService.runCommand(args.command, args.timeout);
          return {
            success: cmdResult.exitCode === 0,
            output: `STDOUT:\n${cmdResult.stdout}\n\nSTDERR:\n${cmdResult.stderr}`,
          };
        
        // Git operations
        case 'git_status':
          if (!this.gitService) throw new Error('Git service not available');
          const status = await this.gitService.status();
          return { success: status.exitCode === 0, output: status.stdout };
        
        case 'git_diff':
          if (!this.gitService) throw new Error('Git service not available');
          const diff = await this.gitService.diff('/workspace', args.file_path);
          return { success: diff.exitCode === 0, output: diff.stdout };
        
        case 'git_diff_staged':
          if (!this.gitService) throw new Error('Git service not available');
          const staged = await this.gitService.diffStaged();
          return { success: staged.exitCode === 0, output: staged.stdout };
        
        case 'git_add':
          if (!this.gitService) throw new Error('Git service not available');
          await this.gitService.add(args.paths);
          return { success: true, output: `Staged ${args.paths.length} file(s)` };
        
        case 'git_commit':
          if (!this.gitService) throw new Error('Git service not available');
          const commit = await this.gitService.commit(args.message);
          return {
            success: commit.exitCode === 0,
            output: commit.stdout + (commit.stderr ? '\n' + commit.stderr : ''),
          };
        
        case 'git_log':
          if (!this.gitService) throw new Error('Git service not available');
          const log = await this.gitService.log(args.limit || 10);
          return { success: log.exitCode === 0, output: log.stdout };
        
        case 'git_branch':
          if (!this.gitService) throw new Error('Git service not available');
          const branch = await this.gitService.currentBranch();
          return { success: true, output: branch };
        
        // Task completion
        case 'task_complete':
          return { success: true, output: args.summary || 'Task completed.' };
          
        default:
          return { success: false, output: `Unknown tool: ${toolName}` };
      }
    } catch (err: any) {
      return { success: false, output: `Error executing ${toolName}: ${err.message}` };
    }
  }
}