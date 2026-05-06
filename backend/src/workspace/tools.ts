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
