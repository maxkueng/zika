import type { MqttClient } from 'mqtt';
import type { Logger } from 'pino';

import type { Config } from './config';

export function startAvailabilityService(mqttClient: MqttClient, config: Config, logger: Logger) {
  let publishInterval: NodeJS.Timeout;


  mqttClient.on('connect', () => {
    startPublishing();
  });

  mqttClient.on('disconnect', () => {
    stopPublishing();
  });
  
  const publishAvailability = () => {
    try {
      mqttClient.publish(config.mqtt.availabilityTopic, JSON.stringify({
        status: 'online',
      }, null, '  '));
    } catch (err) {
      logger.error('MQTT error:', err);
    }
  }

  const startPublishing = () => {
    publishAvailability();

    publishInterval = setInterval(() => {
      publishAvailability();
    }, 60000);
  }

  const stopPublishing = () => {
    clearInterval(publishInterval);
  }
}