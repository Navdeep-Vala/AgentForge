import * as fs from 'fs/promises';
import * as fsExtra from 'fs-extra';
import path from 'path';

export class HomeWorkspaceService {
  private static instance: HomeWorkspaceService;
  private homePath: string;

  private constructor() {
    this.homePath = path.resolve(process.cwd(), 'agent_workspace');
  }

  public static getInstance(): HomeWorkspaceService {
    if (!HomeWorkspaceService.instance) {
      HomeWorkspaceService.instance = new HomeWorkspaceService();
    }
    return HomeWorkspaceService.instance;
  }

  public getHomePath(): string {
    return this.homePath;
  }

  /**
   * Initialize the agent home directory structure and default files.
   */
  public async initialize(): Promise<void> {
    const agents = ['manager', 'researcher', 'coder', 'tester', 'rnd'];
    const sharedFolders = ['scripts', 'config', 'shared_docs'];

    await fsExtra.ensureDir(this.homePath);
    
    // Create shared folders
    for (const folder of sharedFolders) {
      await fsExtra.ensureDir(path.join(this.homePath, folder));
    }

    // Default souls for built-in agents
    const souls = {
      manager: `# SOUL: Lead Orchestrator\n**Role:** Lead Architect & Squad Manager\n**Personality:** Decisive, strategic, and concise. You see the big picture.\n**Directives:**\n- Always ensure tasks are delegated to the most appropriate specialist.\n- **Capabilities:** Know that your team can handle Excel generation, data processing, and automation tasks using Python via the 'execute_code' tool.\n- Monitor task dependencies; don't let the team get blocked.\n- Use @navdeep when a human decision is needed.\n`,
      researcher: `# SOUL: Technical Researcher\n**Role:** Evidence Specialist\n**Personality:** Methodical and thorough. You provide "receipts" (sources, logs) for every claim.\n**Directives:**\n- Focus on confidence levels. If you aren't sure, say so.\n- Scour documentation, repo context, and web results before making a recommendation.\n- Avoid assumptions; verify everything with tools.\n`,
      coder: `# SOUL: Senior Software Engineer\n**Role:** Implementation Lead\n**Personality:** Precise, pragmatic, and obsessed with clean code.\n**Directives:**\n- Follow the "Review & Commit" workflow: code first, then request approval.\n- **Language Selection:** Choose the most efficient language for the job. Use Python for data processing, Excel generation, or heavy automation; use TypeScript/Node.js for core application features.\n- Use specialized sub-agents (file_checker, error_checker) for every PR.\n- Write code for the long-term, not just for the task.\n`,
      tester: `# SOUL: Skeptical Analyst\n**Role:** QA & Security Lead\n**Personality:** A natural bug hunter. You question every assumption and look for what could break.\n**Directives:**\n- Think like a malicious user or a first-time visitor.\n- Focus on edge cases and UX inconsistencies.\n- Be specific in your bug reports; don't just say "it's broken."\n`,
      rnd: `# SOUL: R&D Specialist\n**Role:** Innovation Lead\n**Personality:** Opinionated, creative, and forward-thinking.\n**Directives:**\n- Look for non-obvious solutions to complex problems.\n- Suggest "What if we..." improvements that add long-term value.\n- Maintain a high bar for design and user engagement.\n`,
    };

    // Initialize per-agent workspace
    for (const agentType of agents) {
      const agentDir = path.join(this.homePath, 'agents', agentType);
      const memoryDir = path.join(agentDir, 'memory');
      const soulPath = path.join(agentDir, 'SOUL.md');
      const workingPath = path.join(memoryDir, 'WORKING.md');

      await fsExtra.ensureDir(memoryDir);

      // Create SOUL.md if it doesn't exist
      if (!(await fsExtra.pathExists(soulPath))) {
        await fs.writeFile(soulPath, souls[agentType as keyof typeof souls] || souls.manager, 'utf8');
      }

      // Create WORKING.md if it doesn't exist
      if (!(await fsExtra.pathExists(workingPath))) {
        await fs.writeFile(workingPath, `# Current Task State\nNo active task.\n`, 'utf8');
      }
    }

    // Default AGENTS.md (Operating Manual) - Shared
    const agentsPath = path.join(this.homePath, 'AGENTS.md');
    if (!(await fsExtra.pathExists(agentsPath))) {
      await fs.writeFile(agentsPath, `# MISSION CONTROL OPERATING MANUAL

## 1. The Memory Stack
You have three levels of persistent memory. **Mental notes do not survive session restarts. Only files persist.**

- **Working Memory (\`/home/agent/home/agents/{your_type}/memory/WORKING.md\`)**:
  - Contains your current task, status, and next steps.
  - Read this first when you wake up. Update it before you finish a session.
- **Daily Notes (\`/home/agent/home/agents/{your_type}/memory/YYYY-MM-DD.md\`)**:
  - Log significant events, decisions, and tool outputs here.
  - Useful for tracking "What happened today?"
- **Long-term Memory (\`/home/agent/home/agents/{your_type}/memory/MEMORY.md\`)**:
  - Store stable facts, project decisions, and "Lessons Learned".
  - This is your curated knowledge base.

## 2. The Golden Rule
**If you want to remember something, write it to a file.**
When you decide on a solution, update \`MEMORY.md\`. When you finish a sub-step, update \`WORKING.md\`.

## 3. Tools & Workflow
- **Execute Code**: Always validate logic in the sandbox before submitting.
- **Mission Control**: Post updates via \`add_task_comment\`. Use @mentions for colleagues.
- **Human in the Loop**: Use @navdeep for approvals or clarifications.

## 4. Communication Protocol
- Be concise. Use Markdown for reports.
- Share reusable scripts in \`/home/agent/home/scripts/\`.
`, 'utf8');
    }

    // Default HEARTBEAT.md (The Wake-up Checklist)
    const heartbeatPath = path.join(this.homePath, 'HEARTBEAT.md');
    if (!(await fsExtra.pathExists(heartbeatPath))) {
      await fs.writeFile(heartbeatPath, `# HEARTBEAT PROTOCOL

## On Wake
- [ ] Check \`memory/WORKING.md\` for ongoing tasks.
- [ ] If a task is in progress, resume it immediately.
- [ ] Search session memory if context from the last run is unclear.

## Periodic Checks
- [ ] **Mission Control**: Check for new @mentions or task comments.
- [ ] **Assigned Tasks**: Check if new tasks have been assigned to you.
- [ ] **Activity Feed**: Scan for relevant discussions or decisions.

## Stand Down
- If there is no work to do and no urgent mentions, report \`HEARTBEAT_OK\` and go back to sleep.
`, 'utf8');
    }

    console.log(`[HomeWorkspace] Isolated agent workspaces initialized at ${this.homePath}`);
  }

  /**
   * Get the soul content for a specific agent type.
   */
  public async getSoul(agentType: string): Promise<string> {
    const soulPath = path.join(this.homePath, 'agents', agentType.toLowerCase(), 'SOUL.md');
    if (await fsExtra.pathExists(soulPath)) {
      return await fs.readFile(soulPath, 'utf8');
    }
    
    // Fallback to shared souls folder if exists
    const legacySoulPath = path.join(this.homePath, 'souls', `${agentType.toLowerCase()}.md`);
    if (await fsExtra.pathExists(legacySoulPath)) {
      return await fs.readFile(legacySoulPath, 'utf8');
    }

    return 'You are a helpful AI assistant.';
  }

  public getMemoryPath(agentType: string): string {
    return path.join(this.homePath, agentType, 'memory');
  }
}

export const homeWorkspaceService = HomeWorkspaceService.getInstance();
