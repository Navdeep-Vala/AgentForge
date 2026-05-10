import fs from 'fs-extra';
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
    const folders = [
      'memory',
      'scripts',
      'config',
      'souls',
    ];

    await fs.ensureDir(this.homePath);
    for (const folder of folders) {
      await fs.ensureDir(path.join(this.homePath, folder));
    }

    // Default souls for built-in agents
    const souls = {
      manager: `# Manager - Squad Lead
You are the Lead Agent of the AgentForge squad.
Your goal is to oversee the entire mission, delegate tasks, and ensure high-quality delivery.
You are professional, concise, and strategic.
`,
      researcher: `# Researcher
You are the Researcher agent.
Your goal is to find technical information, documentation, and best practices.
`,
      coder: `# Coder
You are the Coder agent.
Your goal is to write high-quality, maintainable code.
`,
      tester: `# Tester
You are the Tester agent.
Your goal is to ensure code quality through rigorous testing.
`,
      rnd: `# R&D Specialist
You are the R&D Specialist.
Your goal is to explore new technologies and suggest innovative improvements.
`,
    };

    for (const [type, content] of Object.entries(souls)) {
      const soulPath = path.join(this.homePath, 'souls', `${type.toLowerCase()}.md`);
      if (!(await fs.pathExists(soulPath))) {
        await fs.writeFile(soulPath, content, 'utf8');
      }
    }

    // Default SOUL.md (Legacy fallback)
    const soulPath = path.join(this.homePath, 'SOUL.md');
    if (!(await fs.pathExists(soulPath))) {
      await fs.writeFile(soulPath, souls.manager, 'utf8');
    }

    // Default AGENTS.md
    const agentsPath = path.join(this.homePath, 'AGENTS.md');
    if (!(await fs.pathExists(agentsPath))) {
      await fs.writeFile(agentsPath, `# Agent Instructions
1. Always check your memory in /home/agent/home/memory/ before starting a new task.
2. Log your progress in /home/agent/home/memory/WORKING.md.
3. Use specialized tools for complex tasks.
4. If you discover a reusable script, save it to /home/agent/home/scripts/.
`, 'utf8');
    }

    // Initialize WORKING.md in memory
    const workingPath = path.join(this.homePath, 'memory', 'WORKING.md');
    if (!(await fs.pathExists(workingPath))) {
      await fs.writeFile(workingPath, `# Current Task State\nNo active task.\n`, 'utf8');
    }

    console.log(`[HomeWorkspace] Initialized at ${this.homePath}`);
  }

  /**
   * Get the soul content for a specific agent type.
   */
  public async getSoul(agentType: string): Promise<string> {
    const soulPath = path.join(this.homePath, 'souls', `${agentType.toLowerCase()}.md`);
    if (await fs.pathExists(soulPath)) {
      return await fs.readFile(soulPath, 'utf8');
    }
    // Fallback to default SOUL.md if specific soul doesn't exist
    const defaultSoulPath = path.join(this.homePath, 'SOUL.md');
    if (await fs.pathExists(defaultSoulPath)) {
       return await fs.readFile(defaultSoulPath, 'utf8');
    }
    return 'You are a helpful AI assistant.';
  }
}

export const homeWorkspaceService = HomeWorkspaceService.getInstance();
