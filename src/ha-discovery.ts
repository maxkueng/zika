import type { MqttClient } from 'mqtt';
import type { Logger } from 'pino';

import type { Config } from './config';

export function startHomeAssistantDiscoveryService(mqttClient: MqttClient, config: Config, logger: Logger) {
  if (!config.ha) {
    return;
  }
  
  function getDiscoveryId(str: string) {
    return str.replace(/[^a-zA-Z0-9]+/g, '_');
  }

  const getDiscoveryDeviceInfo = () => {
    if (!config.ha) {
      throw new Error('Missing Home Assistant config');
    }

    return {
      name: config.ha.deviceIdentifier,
      identifiers: [config.ha.deviceIdentifier],
    };
  }
  
  const publishCommandButtonDiscovery = ({
    id,
    name,
    command,
    icon,
  }: {
    id: string;
    name: string;
    command: string;
    icon: string;
  }) => {
    if (!config.ha) {
      throw new Error('Missing Home Assistant config');
    }

    const discovery = {
      name,
      icon,
      command_topic: config.mqtt.commandTopic,
      payload_press: JSON.stringify({ command }),
      unique_id: `${config.ha.deviceIdentifier}_${id}`,
      device: getDiscoveryDeviceInfo(),
      availability: {
        topic: config.mqtt.availabilityTopic,
        value_template: '{{ value_json.status }}',
      },
    };

    try {
      mqttClient.publish(
        `${config.ha.discoveryTopic}/button/${config.ha.deviceIdentifier}/${id}/config`,
        JSON.stringify(discovery),
        {
          qos: 1,
          retain: true,
        },
      );
    } catch (err) {
      console.error('MQTT error:', err);
    }
  }
  
  mqttClient.on('connect', () => {
    Object.keys(config.commands).forEach((command) => {
      const { ha } = config.commands[command];
      if (!ha) {
        return;
      }

      publishCommandButtonDiscovery({
        id: getDiscoveryId(command),
        name: ha.name,
        icon: ha.icon,
        command,
      });
    });
  });
}