import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { env } from './env';

const gatewayConfigSchema = z.object({
  gateway: z.object({
    port: z.number().default(3001),
    host: z.string().default('0.0.0.0'),
    name: z.string().default('AgentForge Gateway'),
  }),
  ai: z.object({
    default_provider: z.string().default('openrouter'),
    default_model: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),
    providers: z.record(z.object({
      base_url: z.string().optional(),
      api_key: z.string().optional(),
    })),
  }),
  channels: z.object({
    telegram: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
    }).optional(),
    discord: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
    }).optional(),
    web: z.object({
      enabled: z.boolean().default(true),
    }).default({ enabled: true }),
  }),
  tools: z.object({
    enabled_tools: z.array(z.string()).default([]),
    sandbox: z.object({
      type: z.enum(['docker', 'local']).default('docker'),
      persist_workspace: z.boolean().default(true),
    }).default({ type: 'docker', persist_workspace: true }),
  }),
  workspace: z.object({
    base_path: z.string().default('./workspaces'),
    default_system_prompt_path: z.string().optional(),
  }),
});

export type GatewayConfig = z.infer<typeof gatewayConfigSchema>;

let config: GatewayConfig | null = null;

export function loadGatewayConfig(): GatewayConfig {
  if (config) return config;

  const configPath = path.resolve(process.cwd(), 'config.json');
  
  if (!fs.existsSync(configPath)) {
    console.warn('[Config] config.json not found, using environment defaults.');
    config = gatewayConfigSchema.parse({
      gateway: { port: env.PORT },
      ai: {
        default_model: env.MANAGER_MODEL,
        providers: {
          openrouter: {
            api_key: env.OPENROUTER_API_KEY,
            base_url: env.OPENROUTER_BASE_URL,
          }
        }
      },
      channels: { web: { enabled: true } },
      workspace: { base_path: './workspaces' }
    });
    return config;
  }

  try {
    const rawData = fs.readFileSync(configPath, 'utf8');
    // Replace ${VAR} with environment variables
    const resolvedData = rawData.replace(/\${([^}]+)}/g, (_, varName) => {
      return process.env[varName] || '';
    });
    
    const parsed = JSON.parse(resolvedData);
    config = gatewayConfigSchema.parse(parsed);
    console.log(`[Config] Loaded configuration for: ${config.gateway.name}`);
    return config;
  } catch (err) {
    console.error('[Config] Failed to load config.json:', err);
    throw err;
  }
}

export const getGatewayConfig = () => loadGatewayConfig();
