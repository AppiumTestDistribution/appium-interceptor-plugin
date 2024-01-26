import { Request, Response, NextFunction } from 'express';
import { DeviceRegisrty } from './android';
import { Client as AdbClient } from '@devicefarmer/adbkit';
import autoBind from '../utils/common';
import _ from 'lodash';
import { ProxySession } from './proxy-session';
import { v4 as uuid } from 'uuid';
import { setupProxyServer } from '../utils/proxy';
import { ADB as AppiumADB } from 'appium-adb';
import { configureWifiProxy } from '../utils/adb';
import { EventBus } from './notifier/event-bus';
import { SessionCreatedEvent } from './events/session-created-event';

export class ApiController {
  private sessionMap: Map<string, ProxySession> = new Map();

  constructor(
    private deviceRegistry: DeviceRegisrty,
    private adb: AdbClient,
    private appiumAdb: AppiumADB,
    private eventBus: EventBus
  ) {
    autoBind(this);
  }

  public getDevices(request: Request, response: Response, next: NextFunction) {
    return response.status(200).json(this.deviceRegistry.getDevices());
  }

  public async startSession(request: Request, response: Response, next: NextFunction) {
    const { udid } = request.params;
    const device = this.deviceRegistry.getDevice(udid);
    if (!device) {
      return response.status(400).json({
        success: true,
        message: `Device with udid ${udid} not found`,
      });
    }
    try {
      const sessionId = uuid();
      const proxy = await setupProxyServer(sessionId, udid, device.isReal);
      await configureWifiProxy(this.appiumAdb, device.udid, device.isReal, proxy);
      const session = new ProxySession(sessionId, device, proxy);
      this.sessionMap.set(udid, new ProxySession(sessionId, device, proxy));
      device.sessionId = sessionId;
      this.eventBus.fire(new SessionCreatedEvent(session));
      return response.status(200).json({
        success: true,
      });
    } catch (err: any) {
      return response.status(400).json({
        success: false,
        message: err.toString(),
      });
    }
  }

  public async stopSession(request: Request, response: Response, next: NextFunction) {
    const { udid } = request.params;
    const device = this.deviceRegistry.getDevice(udid);
    const session = this.sessionMap.get(udid);

    if (!device && !session) {
      return response.status(400).json({
        success: true,
        message: `Device with udid ${udid} not found`,
      });
    }
    try {
      if (session) {
        await session.proxy.stop();
        await configureWifiProxy(
          this.appiumAdb,
          session.device.udid,
          session.device.isReal,
          undefined
        );
      }
      if (device) {
        device.sessionId = undefined;
      }
      return response.status(200).json({
        success: true,
      });
    } catch (err: any) {
      return response.status(400).json({
        success: false,
        message: err.toString(),
      });
    }
  }
}
