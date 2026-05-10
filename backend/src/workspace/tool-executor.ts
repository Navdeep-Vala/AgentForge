import { FileService } from './file.service';
import { CommandService } from './command.service';
import { GitService } from './git.service';
import { WebSearchService } from '../services/web-search.service';
import { DockerService } from '../sandbox/docker.service';

export interface ToolResult {
  success: boolean;
  output: string;
}

export class ToolExecutor {
  constructor(
    private fileService: FileService,
    private commandService: CommandService,
    private gitService?: GitService,
    private webSearchService?: WebSearchService,
    private dockerService?: DockerService,
    private sessionId?: string,
    private callbacks?: {
      addTaskComment?: (content: string, type?: string) => Promise<void>;
      getTaskComments?: (limit?: number) => Promise<any[]>;
    }
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

        // Web Research
        case 'web_search':
          if (!this.webSearchService) throw new Error('Web search service not available');
          const searchResults = await this.webSearchService.search(args.query, args.limit);
          const searchOutput = searchResults.map(r => `[${r.title}](${r.link})\n${r.snippet}`).join('\n\n');
          return { success: true, output: searchOutput || 'No results found.' };

        // Code Execution
        case 'execute_code':
          if (!this.dockerService) throw new Error('Docker service not available');
          if (!this.sessionId) throw new Error('Session ID not available for docker execution');
          
          let fileName = '';
          let runCmd = [];
          
          const language = args.language || 'javascript';
          
          if (language === 'javascript' || language === 'nodejs') {
            fileName = 'temp_exec.js';
            runCmd = ['node', fileName];
          } else if (language === 'typescript') {
            fileName = 'temp_exec.ts';
            runCmd = ['npx', 'tsx', fileName];
          } else if (language === 'python') {
            fileName = 'temp_exec.py';
            runCmd = ['python3', fileName];
          } else {
            throw new Error(`Unsupported language: ${language}`);
          }

          // Write file to workspace first
          await this.fileService.writeFile(fileName, args.code);
          
          // Execute in container
          const execResult = await this.dockerService.executeCommand(this.sessionId, runCmd);
          
          // Cleanup
          await this.fileService.deleteFile(fileName).catch(() => {});

          return {
            success: execResult.exitCode === 0,
            output: `STDOUT:\n${execResult.stdout}\n\nSTDERR:\n${execResult.stderr}`,
          };

        case 'persist_learning':
          const learning = {
            agent: args.agent,
            failure_mode: args.failure_mode,
            correction: args.correction,
            efficiency_gain: args.efficiency_gain,
            timestamp: new Date().toISOString()
          };
          
          let existingLearnings = [];
          try {
            const currentContent = await this.fileService.readFile('lessons_learned.json');
            existingLearnings = JSON.parse(currentContent);
            if (!Array.isArray(existingLearnings)) existingLearnings = [];
          } catch (e) {
            // File doesn't exist or is invalid, start new array
          }
          
          existingLearnings.push(learning);
          await this.fileService.writeFile('lessons_learned.json', JSON.stringify(existingLearnings, null, 2));
          return { success: true, output: 'Learning persisted to lessons_learned.json.' };
        
        case 'add_task_comment':
          if (!this.callbacks?.addTaskComment) throw new Error('Task communication not available');
          await this.callbacks.addTaskComment(args.content, args.comment_type);
          return { success: true, output: 'Comment posted to Mission Control.' };
        
        case 'get_task_comments':
          if (!this.callbacks?.getTaskComments) throw new Error('Task communication not available');
          const comments = await this.callbacks.getTaskComments(args.limit);
          const commentsOutput = comments.map(c => `[${c.agent_name}]: ${c.content}`).join('\n---\n');
          return { success: true, output: commentsOutput || 'No comments found.' };

          
        default:
          return { success: false, output: `Unknown tool: ${toolName}` };
      }
    } catch (err: any) {
      return { success: false, output: `Error executing ${toolName}: ${err.message}` };
    }
  }
}