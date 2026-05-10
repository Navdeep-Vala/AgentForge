import Docker, { Container } from 'dockerode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homeWorkspaceService } from '../services/home-workspace.service';

const execAsync = promisify(exec);

export interface SandboxConfig {
  workspacePath: string;  // Host path to workspace directory
  containerName: string;  // Unique container name
  memoryLimit?: number;   // in MB
  cpuLimit?: number;      // number of CPUs (fraction allowed)
}

export interface MissionControlConfig {
  sessionId: string;
  appImage: string;
  dbImage: string;
  dbName: string;
  dbUser: string;
  dbPass: string;
  workspacePath: string;
  seedsPath: string;
}

export class DockerService {
  private docker: Docker;
  private containers: Map<string, Container>; // sessionId -> container

  constructor() {
    this.docker = new Docker();
    this.containers = new Map();
  }

  async createSandbox(config: SandboxConfig): Promise<string> {
    // 1. Ensure workspace exists on host
    await fs.mkdir(config.workspacePath, { recursive: true });
    const homePath = homeWorkspaceService.getHomePath();

    // 2. Create container with volume mount
    const container = await this.docker.createContainer({
      name: config.containerName,
      Image: 'agentforge-sandbox:latest', // Built from Dockerfile
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Binds: [
          `${config.workspacePath}:/workspace`,
          `${homePath}:/home/agent/home`
        ],
        Memory: (config.memoryLimit ?? 1024) * 1024 * 1024, // Default 1GB
        CpuPeriod: 100000,
        CpuQuota: Math.round((config.cpuLimit ?? 1.0) * 100000), // Default 1.0 CPU
        NetworkMode: 'bridge', // Allow outbound network for npm install, browser tests
      },
      User: '1000', // Run as sandbox user
      WorkingDir: '/workspace',
      Labels: {
        'agentforge.session': config.containerName, // session id
        'managed-by': 'agentforge',
      },
    });

    await container.start();
    this.containers.set(config.containerName, container);
    return (container as any).id;
  }

  async startSandbox(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  async stopSandbox(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop();
  }

  async destroySandbox(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.remove({ force: true });
    this.containers.delete(containerId);
  }

  async executeCommand(
    containerId: string,
    command: string[],
    options?: { timeout?: number; env?: Record<string, string> }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const container = this.docker.getContainer(containerId);

    // Exec creates a new exec instance inside the running container
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      Env: options?.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
    });

    return new Promise((resolve, reject) => {
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let timedOut = false;

      const timeoutHandle = options?.timeout 
        ? setTimeout(() => {
            timedOut = true;
            // Attempt to kill the exec
            exec.kill().catch(() => {});
            reject(new Error(`Command timed out after ${options.timeout}ms`));
          }, options.timeout)
        : undefined;

      exec.stdout.on('data', (chunk: Buffer) => {
        if (timedOut) return;
        stdout.push(chunk);
      });

      exec.stderr.on('data', (chunk: Buffer) => {
        if (timedOut) return;
        stderr.push(chunk);
      });

      exec.on('error', (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });

      exec.on('close', (exitCode: number | null) => {
        if (timedOut) return;
        clearTimeout(timeoutHandle);

        resolve({
          stdout: Buffer.concat(stdout).toString('utf-8'),
          stderr: Buffer.concat(stderr).toString('utf-8'),
          exitCode: exitCode ?? 0,
        });
      });
    });
  }

  async getContainerLogs(containerId: string, tail?: number): Promise<string> {
    const container = this.docker.getContainer(containerId);
    const stream = await container.logs({
      stdout: true,
      stderr: true,
      tail: tail || 100,
      timestamps: false,
    });

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    stream.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    stream.on('error', (_err: unknown) => {
      resolve('');
    });
    });
  }

  async containerExists(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.inspect();
      return true;
    } catch {
      return false;
    }
  }

  async startMissionControl(config: MissionControlConfig): Promise<void> {
    const templatePath = path.join(__dirname, 'docker-compose.mission-control.yaml.template');
    const templateContent = await fs.readFile(templatePath, 'utf-8');

    const composeContent = templateContent
      .replace(/\${APP_IMAGE}/g, config.appImage)
      .replace(/\${DB_IMAGE}/g, config.dbImage)
      .replace(/\${DB_NAME}/g, config.dbName)
      .replace(/\${DB_USER}/g, config.dbUser)
      .replace(/\${DB_PASSWORD}/g, config.dbPass)
      .replace(/\${WORKSPACE_PATH}/g, config.workspacePath)
      .replace(/\${SEEDS_PATH}/g, config.seedsPath);

    const sessionDir = path.join(path.dirname(config.workspacePath), '.docker-compose', config.sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    
    const composePath = path.join(sessionDir, 'docker-compose.yaml');
    await fs.writeFile(composePath, composeContent);

    // Create seeds directory if it doesn't exist
    await fs.mkdir(config.seedsPath, { recursive: true });

    try {
      console.log(`[DockerService] Starting Mission Control for session ${config.sessionId}...`);
      await execAsync(`docker-compose -f ${composePath} up -d`, {
        env: { ...process.env, COMPOSE_PROJECT_NAME: `mission-control-${config.sessionId}` }
      });
    } catch (err) {
      console.error(`[DockerService] Failed to start Mission Control:`, err);
      throw err;
    }
  }

  async stopMissionControl(sessionId: string, workspacePath: string): Promise<void> {
    const sessionDir = path.join(path.dirname(workspacePath), '.docker-compose', sessionId);
    const composePath = path.join(sessionDir, 'docker-compose.yaml');

    try {
      await execAsync(`docker-compose -f ${composePath} down`, {
        env: { ...process.env, COMPOSE_PROJECT_NAME: `mission-control-${sessionId}` }
      });
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (err) {
      console.error(`[DockerService] Failed to stop Mission Control:`, err);
    }
  }

  async getMissionControlContainerId(sessionId: string, workspacePath: string, serviceName: string = 'app-service'): Promise<string> {
    const sessionDir = path.join(path.dirname(workspacePath), '.docker-compose', sessionId);
    const composePath = path.join(sessionDir, 'docker-compose.yaml');

    try {
      const { stdout } = await execAsync(`docker-compose -f ${composePath} ps -q ${serviceName}`, {
        env: { ...process.env, COMPOSE_PROJECT_NAME: `mission-control-${sessionId}` }
      });
      return stdout.trim();
    } catch (err) {
      console.error(`[DockerService] Failed to get container ID for ${serviceName}:`, err);
      return '';
    }
  }
}