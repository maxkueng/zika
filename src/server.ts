import path from 'path';
import fs from 'fs';
import http from 'http';
import type { RequestListener } from 'http';
import https from 'https';
import express from 'express';
import cors from 'cors';
import { StatusCodes } from 'http-status-codes';
import { connect } from 'mqtt';
import { z } from 'zod';
import type { Logger } from 'pino';

import type { Config } from './config';
import {
  register,
  startTimeGauge,
  mqttEventCounter,
  mqttPayloadErrorCounter,
} from './metrics';
import { enqueueCommand } from './queue';

const commandSchema = z.object({
  command: z.string(),
});

function getHttpPort(config: Config) {
  if (config.api.port) {
    return config.api.port;
  }
  if (config.api.ssl) {
    return 443;
  }
  return 80;
}

function createHttpServer(config: Config, requestListener: RequestListener) {
  if (
    config.api.ssl
    && config.api.keyFile
    && config.api.certFile
  ) {
    const keyfilePath = path.resolve(config.api.keyFile);
    const certfilePath = path.resolve(config.api.certFile);

    return https.createServer({
      key: fs.readFileSync(keyfilePath, 'utf-8'),
      cert: fs.readFileSync(certfilePath, 'utf-8'),
    }, requestListener);
  }

  return http.createServer(requestListener);
}

export function startServer(config: Config, logger: Logger) {
  startTimeGauge.setToCurrentTime();
  
  if (config.debug) {
    logger.level = 'debug';
  }

  const mqttClient = connect(config.mqtt.server, {
    username: config.mqtt.user,
    password: config.mqtt.password,
    clientId: config.mqtt.clientId ?? `zika${Math.floor(Math.random() * 100000000)}`,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000,
  });

  mqttClient.on('connect', () => {
    logger.info('MQTT connected');
    mqttEventCounter.inc({ event: 'connect' });
    mqttClient.subscribe(config.mqtt.topic);
  });
  
  mqttClient.on('reconnect', () => {
    mqttEventCounter.inc({ event: 'reconnect' });
    logger.info('Reconnecting to MQTT...');
  });
  
  mqttClient.on('close', () => {
    mqttEventCounter.inc({ event: 'close' });
    logger.info('MQTT connection closed');
  });
  
  mqttClient.on('error', (err) => {
    mqttEventCounter.inc({ event: 'error' });
    logger.error('MQTT error:', err);
  });
  
  mqttClient.on('offline', () => {
    mqttEventCounter.inc({ event: 'offline' });
    logger.warn('MQTT is offline');
  });

  mqttClient.on('message', (topic: string, message: Buffer) => {
    mqttEventCounter.inc({ event: 'message' });
  
    try {
      const payload = commandSchema.parse(JSON.parse(message.toString()));
  
      const shellCommand = config.commands[payload.command];
  
      if (!shellCommand) {
        logger.warn(`Received unknown command: ${payload.command}`);
        return;
      }
  
      logger.info(`Executing command: ${payload.command} -> ${shellCommand}`);
  
      enqueueCommand(shellCommand, config, logger);
    } catch (err) {
      mqttPayloadErrorCounter.inc();
      logger.error('Invalid MQTT payload:', err);
    }
  });
  
  const app = express();
  
  app.use(express.json());
  
  app.use(cors({
    origin: '*',
  }));
  
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  
  app.get(['/livez', '/healthz'], (_req, res) => {
    res.sendStatus(StatusCodes.OK);
  });
  
  app.get('/readyz', async (req, res) => {
    const isMqttConnected = mqttClient.connected;
    
    if (isMqttConnected) {
      if ('verbose' in req.query) {
        res.status(StatusCodes.OK).type('text/plain').send(
          `[#] MQTT check: ok` +
          `    using server ${config.mqtt.server}` +
          `    MQTT connected`
        );
      } else {
        res.sendStatus(StatusCodes.OK);
      }
    } else {
      if ('verbose' in req.query) {
        res.status(StatusCodes.SERVICE_UNAVAILABLE).type('text/plain').send(
          `[#] MQTT check: failed` +
          `    using server ${config.mqtt.server}` +
          `    MQTT not connected`
        );
      } else {
        res.sendStatus(StatusCodes.SERVICE_UNAVAILABLE);
      }
    }
  })

  const httpPort = getHttpPort(config);
  const httpServer = createHttpServer(config, app);

  httpServer.listen(httpPort, config.api.address, () => {
    const protocol = config.api.ssl ? 'https' : 'http';
    const host = config.api.address;
    const apiUrl = `${protocol}://${host}:${httpPort}`;

    logger.info('Zika started');
    logger.info(`API listening on ${apiUrl}`);
    logger.info(`MQTT broker: ${config.mqtt.server}`);
    logger.info(`Using named pipe: ${config.fifoPath}`); 
    if (config.debug) {
      logger.info('Debug mode is enabled');
    }
  });

  return (callback?: () => void) => {
    mqttClient.end(() => {
      httpServer.close(callback);
    });
  };
}
