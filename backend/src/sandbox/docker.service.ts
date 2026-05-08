import Docker from 'dockerode';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SandboxConfig {
  workspacePath: string;  // Host path to workspace directory
  containerName: string;  // Unique container name
  memoryLimit?: number;   // in MB
  cpuLimit?: number;      // number of CPUs (fraction allowed)
}

export class DockerService {
  private docker: Docker;
  private containers: Map<string, Docker.Container>; // sessionId -> container

  constructor() {
    this.docker = new Docker();
    this.containers = new Map();
  }

  async createSandbox(config: SandboxConfig): Promise<string> {
    // 1. Ensure workspace exists on host
    await fs.mkdir(config.workspacePath, { recursive: true });

    // 2. Create container with volume mount
    const container = await this.docker.createContainer({
      name: config.containerName,
      Image: 'agentforge-sandbox:latest', // Built from Dockerfile
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      HostConfig: {
        Binds: [`${config.workspacePath}:/workspace`],
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
    return container.id;
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

      exec.on('close', (exitCode) => {
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
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', () => resolve(''));
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
}