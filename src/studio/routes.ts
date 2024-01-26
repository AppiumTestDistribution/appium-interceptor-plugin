import { Application, Router } from 'express';
import { Client as AdbClient } from '@devicefarmer/adbkit';
import { DeviceRegisrty } from './android';
import { Server } from 'http';
import { registerSocket } from './socket';
import { ApiController } from './controller';
import { ADB as AppiumADB } from 'appium-adb';
import eventBus, { EventBus } from './notifier/event-bus';

type StudioOptions = {
  adb: AdbClient;
  appiumAdb: AppiumADB;
  deviceRegistry: DeviceRegisrty;
  eventBus: EventBus;
};

export function register(app: Application, httpServer: Server, options: StudioOptions) {
  const apiController = new ApiController(
    options.deviceRegistry,
    options.adb,
    options.appiumAdb,
    options.eventBus
  );
  registerSocket(httpServer, options.eventBus);

  const router = Router();
  router.get('/devices', apiController.getDevices);
  router.get('/devices/:udid/session', apiController.startSession);
  router.get('/devices/:udid/session-stop', apiController.stopSession);

  // router.post('/devices/:udid/session', apiController.startSession);
  // router.delete('/devices/:udid/session', apiController.stopSession);
  app.use('/api', router);
}
