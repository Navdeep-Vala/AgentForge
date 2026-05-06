import { FileService } from './file.service';
import { CommandService } from './command.service';

export interface ToolResult {
  success: boolean;
  output: string;
}

export class ToolExecutor {
  constructor(
    private fileService: FileService,
    private commandService: CommandService
  ) {}

  async execute(toolName: string, args: any): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'read_file':
          const content = await this.fileService.readFile(args.path, args.start_line, args.end_line);
          return { success: true, output: content };
        
        case 'write_file':
          await this.fileService.writeFile(args.path, args.content);
          return { success: true, output: `File ${args.path} written successfully.` };
        
        case 'list_directory':
          const files = await this.fileService.listDirectory(args.path, args.recursive);
          return { success: true, output: files.join('\n') };
        
        case 'run_command':
          const result = await this.commandService.runCommand(args.command);
          return { 
            success: result.exitCode === 0, 
            output: `STDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}` 
          };
        
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
