import {
  Counter,
  Gauge,
  register,
} from 'prom-client';

export { register };

export const startTimeGauge = new Gauge({
  name: 'zika_start_time_seconds',
  help: 'Start time of the server in seconds since epoch',
});

export const mqttEventCounter = new Counter({
  name: 'zika_mqtt_events_total',
  help: 'Total MQTT events',
  labelNames: ['event'],
});

export const mqttPayloadErrorCounter = new Counter({
  name: 'zika_mqtt_payload_error_total',
  help: 'Total MQTT payload errors',
});
