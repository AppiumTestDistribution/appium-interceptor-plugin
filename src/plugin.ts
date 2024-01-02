import { BasePlugin } from 'appium/plugin';
import http from 'http';
import { Application } from 'express';
import { CliArg, ISessionCapability } from './types';
import _ from 'lodash';
import { configureWifiProxy, isRealDevice } from './utils/adb';
import { cleanUpProxyServer, setupProxyServer } from './utils/proxy';
import proxyCache from './proxy-cache';
export class AppiumInterceptorPlugin extends BasePlugin {
  constructor(name: string, cliArgs: CliArg) {
    super(name, cliArgs);
  }

  static async updateServer(expressApp: Application, httpServer: http.Server, cliArgs: CliArg) {}

  async createSession(
    next: () => any,
    driver: any,
    jwpDesCaps: any,
    jwpReqCaps: any,
    caps: ISessionCapability
  ) {
    const response = await next();
    //If session creation failed
    if ((response.value && response.value.error) || response.error) {
      return response;
    }

    const interceptFlag = _.merge(caps.alwaysMatch, caps.firstMatch[0] || {})['appium:intercept'];
    const sessionCaps = response.value[1];

    const deviceUDID = sessionCaps.deviceUDID;
    const sessionId = response.value[0];
    const platformName = sessionCaps.platformName;
    const adb = driver.sessions[response.value[0]]?.adb;

    if (interceptFlag && platformName.toLowerCase().trim() === 'android') {
      const realDevice = await isRealDevice(adb, deviceUDID);
      const proxy = await setupProxyServer(sessionId, deviceUDID, realDevice);
      await configureWifiProxy(adb, deviceUDID, realDevice, proxy);
      proxyCache.add(sessionId, proxy);
    }
    return response;
  }

  async deleteSession(next: () => any, driver: any, sessionId: any) {
    const proxy = proxyCache.get(sessionId);
    if (proxy) {
      const adb = driver.sessions[sessionId]?.adb;
      await configureWifiProxy(adb, proxy.getDeviceUDID(), false);
      await cleanUpProxyServer(proxy);
    }
    return next();
  }
}
