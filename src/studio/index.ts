import bodyParser from 'body-parser';
import express from 'express';
import { register } from './routes';
import Adb from '@devicefarmer/adbkit';
import { DeviceRegisrty } from './android';
import http from 'http';
import ADB from 'appium-adb';
import { EventBus } from './notifier/event-bus';

const DEFAULT_PORT = 8555;

export async function main() {
  const app = express();
  const server = http.createServer(app);
  app.use(bodyParser.json());

  const adb = Adb.createClient();
  const appiumAdb = await ADB.createADB({});
  const deviceRegistry = new DeviceRegisrty(adb);
  const eventBus = new EventBus();

  register(app, server, {
    adb,
    deviceRegistry,
    appiumAdb,
    eventBus,
  });

  await deviceRegistry.start();
  server.listen(DEFAULT_PORT, () => {
    console.log('Studio started on port ' + DEFAULT_PORT);
  });
}
if (require.main === module) {
  main();
}
