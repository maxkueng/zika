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
    commandTopic: z.string().default('zika/command'),
    availabilityTopic: z.string().default('zika/availability'),
  }),
  
  ha: z.object({
    deviceIdentifier: z.string(),
    discoveryTopic: z.string(),
  }).optional(),
  
  commands: z.record(z.object({
    command: z.string(),
    ha: z.object({
      name: z.string(),
      icon: z.string(),
    }).optional(),
  })),

  fifoPath: z.string().default('/run/zika/zika-command.fifo'),
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
