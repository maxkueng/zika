import fs from 'fs/promises';
import type { Logger } from 'pino';

import type { Config } from './config';

const commandQueue: string[] = [];
let runningCommand = false;

export function enqueueCommand(cmd: string, config: Config, logger: Logger) {
  commandQueue.push(cmd);
  processQueue(config, logger);
}

async function writeToFifo(fifoPath: string, command: string) {
  const fifoHandle = await fs.open(fifoPath, 'w');
  await fifoHandle.writeFile(command + '\n');
  await fifoHandle.close();
}

export async function processQueue(config: Config, logger: Logger) {
  if (runningCommand || commandQueue.length === 0) {
    return;
  }

  const cmd = commandQueue.shift();
  if (!cmd) return;

  runningCommand = true;
  logger.info(`Writing queued command to FIFO: ${cmd}`);

  try {
    const fifoPath = config.fifoPath;
    await writeToFifo(fifoPath, cmd);
  } catch (err) {
    logger.error(`Failed to write to FIFO:`, err);
  } finally {
    runningCommand = false;
    processQueue(config, logger);
  }
}
