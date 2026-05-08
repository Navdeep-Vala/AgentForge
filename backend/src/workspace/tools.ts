export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file. Returns the file content as text.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from workspace root' },
        start_line: { type: 'number', description: 'Optional start line (1-indexed)' },
        end_line: { type: 'number', description: 'Optional end line (1-indexed)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file with the given content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from workspace root' },
        content: { type: 'string', description: 'Full file content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories in a directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to workspace' },
        recursive: { type: 'boolean', description: 'Whether to list recursively (default: false)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the workspace.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path of file to delete' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_exists',
    description: 'Check if a file or directory exists.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to check' },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command in the workspace directory. Use for npm, git, tests.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to run' },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_status',
    description: 'Show git status of the repository.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'git_diff',
    description: 'Show changes between working tree and HEAD. Use to see what files were modified.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Optional specific file to diff' },
      },
      required: [],
    },
  },
  {
    name: 'git_diff_staged',
    description: 'Show staged changes (cached diff).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'git_add',
    description: 'Stage files for commit.',
    parameters: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string' }, description: 'List of file paths to stage' },
      },
      required: ['paths'],
    },
  },
  {
    name: 'git_commit',
    description: 'Commit staged changes with a message.',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Commit message' },
      },
      required: ['message'],
    },
  },
  {
    name: 'git_log',
    description: 'Show recent commit history.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of commits to show (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'git_branch',
    description: 'Get the current branch name.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'task_complete',
    description: 'Signal that the task is done. Provide a summary of changes made.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Markdown summary of what was done' },
      },
      required: ['summary'],
    },
  },
];
