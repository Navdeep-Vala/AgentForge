import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as queries from '../db/queries';
import { Project } from '../types';
import { fetchRepoContext } from '../services/repo.service';

export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, repo_url, workspace_path } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const project: Project = {
      id: uuidv4(),
      name,
      description: description || null,
      repo_url: repo_url || null,
      repo_context: null,
      workspace_path: workspace_path || null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    await queries.createProject(project);
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function syncProjectRepo(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { token } = req.body;

    const project = await queries.getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (!project.repo_url) {
      res.status(400).json({ error: 'Project has no repo URL configured' });
      return;
    }

    const repo_context = await fetchRepoContext(project.repo_url, token);
    await queries.updateProject(id, { repo_context, updated_at: Date.now() });

    res.json({ success: true, size: repo_context.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProjects(req: Request, res: Response): Promise<void> {
  try {
    const projects = await queries.getAllProjects();
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const project = await queries.getProjectById(id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;
    await queries.updateProject(id, { ...updates, updated_at: Date.now() });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await queries.deleteProject(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
