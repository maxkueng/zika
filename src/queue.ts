import { exec } from 'child_process';
import type { Logger } from 'pino';

import type { Config } from './config';

const commandQueue: string[] = [];
let runningCommand = false;

export function enqueueCommand(cmd: string, config: Config, logger: Logger) {
  commandQueue.push(cmd);
  processQueue(config, logger);
}

export function processQueue(config: Config, logger: Logger) {
  if (runningCommand || commandQueue.length === 0) {
    return;
  }

  const cmd = commandQueue.shift();
  if (!cmd) return;

  runningCommand = true;
  
  logger.info(`Running queued command: ${cmd}`);
  
  const child = exec(
    cmd,
    {
      env: {
        ...process.env,
        PATH: `${config.hostToolsPath}:${process.env.PATH}`
      },
    },
    (err, stdout, stderr) => {
      runningCommand = false;
      if (err) {
        logger.error(`Command failed: ${cmd}`, err);
      }
      if (stdout) logger.info(`Command output: ${stdout}`);
      if (stderr) logger.warn(`Command error output: ${stderr}`);
      processQueue(config, logger);
    },
  );

  child.on('error', (err) => {
    logger.error(`Child process error:`, err);
    runningCommand = false;
    processQueue(config, logger);
  });
}
