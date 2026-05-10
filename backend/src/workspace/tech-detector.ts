import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProjectTech {
  appImage: string;
  dbImage: string;
  dbType: 'postgres' | 'mysql';
}

export async function detectTechnologies(workspaceDir: string): Promise<ProjectTech> {
  const files = await fs.readdir(workspaceDir);
  
  let appImage = 'node:18-slim'; // Default
  let dbImage = 'postgres:15-alpine'; // Default
  let dbType: 'postgres' | 'mysql' = 'postgres';

  if (files.includes('package.json')) {
    appImage = 'node:18-slim';
    // Check for DB type in package.json or other files
    const pkgJson = JSON.parse(await fs.readFile(path.join(workspaceDir, 'package.json'), 'utf-8'));
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    if (deps['mysql'] || deps['mysql2'] || deps['sequelize']) {
      dbImage = 'mysql:8.0';
      dbType = 'mysql';
    }
  } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
    appImage = 'python:3.11-slim';
  } else if (files.includes('composer.json')) {
    appImage = 'php:8.2-cli';
    dbImage = 'mysql:8.0'; // Common for PHP
    dbType = 'mysql';
  }

  // Further checks for DB type
  if (files.includes('prisma')) {
    const prismaSchema = await fs.readFile(path.join(workspaceDir, 'prisma', 'schema.prisma'), 'utf-8').catch(() => '');
    if (prismaSchema.includes('provider = "mysql"')) {
      dbImage = 'mysql:8.0';
      dbType = 'mysql';
    }
  }

  return { appImage, dbImage, dbType };
}
