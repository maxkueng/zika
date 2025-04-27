import fs from 'fs';
import path from 'path';
import * as toml from 'toml';
import { z } from 'zod';

export const configSchema = z.object({
  debug: z.boolean().default(false),
  
  api: z.object({
    port: z.number().optional(),
    address: z.string().default('127.0.0.1'),
    ssl: z.boolean().default(false),
    keyFile: z.string().optional(),
    certFile: z.string().optional(),
  }).refine(
    (api) => !api.ssl || (api.keyFile && api.certFile),
    {
      message: 'keyFile and certFile are required when ssl is true',
      path: ['ssl'],
    }
  ),

  mqtt: z.object({
    server: z.string().url(),
    user: z.string().optional(),
    password: z.string().optional(),
    clientId: z.string().optional(),
    topic: z.string().default('zika'),
  }),

  commands: z.record(z.string()),
  
  hostToolsPath: z.string().default('/host-tools'),
});


export type Config = z.infer<typeof configSchema>;

type LoadConfigOptions = {
  defaults: Partial<Config>;
  configPath?: string;
};

export function loadConfig({
  configPath,
  defaults,
}: LoadConfigOptions) {
  const resolvedPath = configPath
    ? path.resolve(configPath)
    : path.join(process.cwd(), 'zika.toml');

  const rawToml = fs.readFileSync(resolvedPath, 'utf-8');
  const parsed = toml.parse(rawToml);

  const config = configSchema.parse(parsed);

  return {
    ...defaults,
    ...config,
  };
}
