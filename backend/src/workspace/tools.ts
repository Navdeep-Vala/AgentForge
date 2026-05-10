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
  {
    name: 'spawn_sub_agent',
    description: 'Spawn a specialized sub-agent to handle a sub-task in parallel. Use this when the task can be broken into independent smaller tasks that can run concurrently. Available sub-agent types: file_checker, error_checker, test_runner, code_reviewer, security_auditor. After all sub-agents complete, aggregate their results.',
    parameters: {
      type: 'object',
      properties: {
        sub_agent_type: { type: 'string', description: 'Type of sub-agent: file_checker | error_checker | test_runner | code_reviewer | security_auditor' },
        title: { type: 'string', description: 'Title of the sub-task' },
        description: { type: 'string', description: 'Detailed instructions for the sub-agent' },
      },
      required: ['sub_agent_type', 'title', 'description'],
    },
  },
  {
    name: 'spawn_specialized_agent',
    description: 'Create and delegate work to a new specialized agent that does not currently exist in the team. Use this when the task requires a very specific domain expertise (e.g., database migration specialist, accessibility auditor, internationalization expert, performance profiler) that is not covered by any existing built-in agent. The system will automatically provision this agent for you. Use with sub_agents_to_spawn to define parallel sub-agent work.',
    parameters: {
      type: 'object',
      properties: {
        agent_type: { type: 'string', description: 'Unique name for the new specialized agent type (e.g., "db_migration_specialist", "a11y_auditor")' },
        title: { type: 'string', description: 'Title for the specialized agent task' },
        description: { type: 'string', description: 'Detailed instructions for the specialized agent' },
        sub_agents_to_spawn: { type: 'array', description: 'Optional list of sub-agent types to spawn in parallel (e.g., ["file_checker", "error_checker"])', items: { type: 'string' } },
      },
      required: ['agent_type', 'title', 'description'],
    },
  },
  {
    name: 'request_clarification',
    description: 'Pause execution and ask the user (navdeep) for clarification or additional information needed to proceed. Use this when the task is ambiguous, requirements are unclear, or critical information is missing. The task will remain paused until the user responds.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The specific question or clarification needed from the user' },
        context: { type: 'string', description: 'Additional context about what was already done or what is unclear' },
        options: { type: 'array', description: 'Suggested options for the user to choose from (optional)', items: { type: 'string' } },
      },
      required: ['question'],
    },
  },
  {
    name: 'request_approval',
    description: 'Submit completed work for review and request user approval before proceeding (e.g., before committing code). The task will enter a "needs_approval" state and wait for the user to review and approve or request changes.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the work being submitted for approval' },
        summary: { type: 'string', description: 'Summary of what was done and what is being submitted for review' },
        files_changed: { type: 'string', description: 'Description of files changed or created' },
      },
      required: ['title', 'summary'],
    },
  },
  {
    name: 'web_search',
    description: 'Perform a web search to find latest information, documentation, or solutions. Returns search results with snippets and URLs.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        limit: { type: 'number', description: 'Number of results to return (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'execute_code',
    description: 'Execute JavaScript, TypeScript, or Python code in a safe Docker sandbox. Use this to test logic, perform calculations, or validate code snippets.',
    parameters: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'Language: javascript | typescript | python' },
        code: { type: 'string', description: 'The code to execute' },
      },
      required: ['language', 'code'],
    },
  },
];
