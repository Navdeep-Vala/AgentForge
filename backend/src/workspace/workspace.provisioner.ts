import { ensureDir } from 'fs-extra';
import * as path from 'path';
import { DockerService } from '../sandbox/docker.service';
import { GitService } from '../workspace/git.service';

export class WorkspaceProvisioner {
  constructor(private docker: DockerService) {}

  async provisionWorkspace(
    sessionId: string,
    workspacePath: string,
    repoUrl?: string,
    branch?: string
  ): Promise<string> {
    // Ensure workspace dir exists on host
    await ensureDir(workspacePath);

    // Create and start container
    const containerId = await this.docker.createSandbox({
      workspacePath,
      containerName: `agentforge-${sessionId}`,
    });

    // If repoUrl provided, clone inside container
    if (repoUrl) {
      // Wait for container to be ready (simple sleep or health check)
      await new Promise((r) => setTimeout(r, 1000));

      // Create GitService bound to this container
      const git = new GitService(this.docker, containerId);
      try {
        await git.clone(repoUrl, '/workspace', branch);
      } catch (err) {
        // Clone failed — stop container and throw
        await this.docker.destroySandbox(containerId);
        throw new Error(`Failed to clone repository: ${err instanceof Error ? err.message : err}`);
      }
    }

    return containerId;
  }
}