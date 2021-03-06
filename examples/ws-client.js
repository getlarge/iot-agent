/* Copyright 2019 Edouard Maleix, read LICENSE */

/* eslint-disable no-underscore-dangle */

const mqtt = require('async-mqtt');
const EventEmitter = require('events');
// const {updateAloesSensors} = require('aloes-handlers';
const logger = require('aloes-logger');
const {patternDetector} = require('../src/index');
const {accounts, sensors} = require('./initial-data');

// Mocking a web browser working on AloesClient protocol
// '+userId/+collection/+method',

const wsClient = new EventEmitter();
module.exports = wsClient;

let client;

wsClient.on('init', config => {
  logger(3, 'ws-client', 'init', config.wsClient);
  client = mqtt.connect(config.wsBrokerUrl, config.wsClient);

  client.on('error', err => {
    wsClient.emit('error', err);
  });

  client.on('connect', async state => {
    wsClient.emit('status', state);
    wsClient.user = client._client.options.username;
    if (client && wsClient.user) {
      await client.subscribe(`${wsClient.user}/Sensor/#`);
      await client.subscribe(`${wsClient.user}/Device/#`);
    }
    return null;
  });

  client.on('offline', state => {
    delete wsClient.user;
    wsClient.emit('status', state);
  });

  client.on('message', (topic, message) => {
    try {
      // if (!wsClient.user) {
      //   return new Error('Error: Invalid mqtt client');
      // }
      return wsClient.emit('message', topic, message);
    } catch (error) {
      logger(4, 'ws-client', 'publish:err', error);
      return null;
    }
  });
});

wsClient.on('message', async (topic, message) => {
  try {
    const payload = JSON.parse(message);
    const packet = {topic, payload};

    const pattern = await patternDetector(packet);
    logger(4, 'ws-client', 'onMessage:req', {pattern});

    if (!pattern) return null;
    if (
      pattern.name.toLowerCase() === 'aloesclient' &&
      (pattern.params.method === 'POST' || pattern.params.method === 'PUT') &&
      pattern.params.userId === accounts[0].id.toString() &&
      pattern.params.collection === 'Sensor' &&
      payload
    ) {
      if (
        payload.resource === 5910 &&
        payload.resources['5910'] &&
        sensors[1].id === payload.id.toString()
      ) {
        //  update instance and send it to broker`,
        logger(2, 'ws-client', 'image received from broker', payload.resource);

        // const updatedSensor = await updateAloesSensors(
        //   sensors[1],
        //   Number(payload.resource),
        //   payload.resources['5911'],
        // );

        // const newTopic = `${updatedSensor.devEui}-in/1/${updatedSensor.type}/${
        //   updatedSensor.nativeNodeId
        // }/${updatedSensor.nativeSensorId}/5911`;

        // if (newTopic && updatedSensor && updatedSensor !== null) {
        //   // await wsClient.emit('publish', newTopic, updatedSensor);
        //   return client.publish(newTopic, payload.value.toString());
        // }
      }
    }

    logger(4, 'ws-client', 'onMessage:res', {pattern});
    return null;
  } catch (error) {
    return null;
  }
});
