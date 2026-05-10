export const TOOL_USAGE_PROMPT = `
## Tool Usage Capabilities

You have access to a variety of tools to help you complete your task:
1. **Web Search** (\`web_search\`): Use this to find documentation, libraries, latest information, or solve bugs you haven't seen before.
2. **Code Execution** (\`execute_code\`): Execute JavaScript, TypeScript, or Python code in a safe sandbox. Use this to test logic, validate algorithms, or perform complex data processing.
3. **File Operations**: read, write, list, and delete files in the workspace.
4. **Git Operations**: Stage, commit, and view history.
5. **Parallel Sub-Agents** (\`spawn_sub_agent\`): Delegate independent sub-tasks to specialized agents (file_checker, error_checker, test_runner, etc.).
6. **Dynamic Specialized Agents** (\`spawn_specialized_agent\`): Create a new type of expert agent for unique domain requirements.

## Reasoning & Internal Monologue

Before using any tool, you SHOULD think through your approach. Your internal thoughts will be captured and displayed to the user to provide transparency into your decision-making process.

## Native Tool Calling

You should use the native tool calling capability of the model whenever possible. If the model does not support native tool calling, you can fallback to providing a JSON block in your response:
{\\"tool\\": \\"tool_name\\", \\"args\\": {\\"arg1\\": \\"val1\\"}}
`;
