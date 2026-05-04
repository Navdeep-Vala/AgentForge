import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  getAllCustomAgents,
  createCustomAgent,
  getCustomAgentById,
  updateCustomAgent,
  deleteCustomAgent,
  getCustomAgentByType,
} from '../db/queries';
import { getBuiltInAgentDefinitions } from '../agents/agent.registry';

const agentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  system_prompt: z.string().min(1),
  model: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{3,6}$/, 'Invalid color hex'),
  icon: z.string().min(1).max(50),
});

const updateAgentSchema = agentSchema.partial();

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function listAgentsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const builtIn = getBuiltInAgentDefinitions().map((a) => ({ ...a, is_builtin: true }));
    const custom = (await getAllCustomAgents()).map((a) => ({ ...a, is_builtin: false }));
    res.json({ agents: [...builtIn, ...custom] });
  } catch (err) {
    next(err);
  }
}

export async function createAgentHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = agentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const data = parsed.data;
    const type = nameToSlug(data.name);

    if (!type) {
      res.status(400).json({ error: 'Invalid agent name — cannot generate type slug' });
      return;
    }

    const existing = await getCustomAgentByType(type);
    if (existing) {
      res.status(409).json({ error: `Agent type "${type}" already exists` });
      return;
    }

    const agent = {
      id: uuidv4(),
      name: data.name,
      type,
      description: data.description,
      system_prompt: data.system_prompt,
      model: data.model,
      color: data.color,
      icon: data.icon,
      is_active: true,
      created_at: Date.now(),
    };

    await createCustomAgent(agent);
    res.status(201).json({ agent });
  } catch (err) {
    next(err);
  }
}

export async function updateAgentHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const agent = await getCustomAgentById(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const parsed = updateAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    await updateCustomAgent(agent.id, parsed.data);
    const updated = await getCustomAgentById(agent.id);
    res.json({ agent: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteAgentHandler(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const agent = await getCustomAgentById(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    await deleteCustomAgent(agent.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
