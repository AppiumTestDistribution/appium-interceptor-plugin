import { BasePlugin } from 'appium/plugin';
import http from 'http';
import { Application } from 'express';
import { CliArg, ISessionCapability, MockConfig } from './types';
import _ from 'lodash';
import { configureWifiProxy, isRealDevice } from './utils/adb';
import { cleanUpProxyServer, sanitizeMockConfig, setupProxyServer } from './utils/proxy';
import proxyCache from './proxy-cache';
import logger from './logger';
import { validateMockConfig } from './schema';

export class AppiumInterceptorPlugin extends BasePlugin {
  static executeMethodMap = {
    'interceptor: addMock': {
      command: 'addMock',
      params: { required: ['config'] },
    },

    'interceptor: removeMock': {
      command: 'removeMock',
      params: { required: ['id'] },
    },
  };

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

    const mergedCaps = { ...caps.alwaysMatch, ..._.get(caps, 'firstMatch[0]', {}) };
    const interceptFlag = mergedCaps['appium:intercept'];
    const { deviceUDID, platformName } = response.value[1];
    const sessionId = response.value[0];
    const adb = driver.sessions[sessionId]?.adb;

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
      await configureWifiProxy(adb, proxy.deviceUDID, false);
      await cleanUpProxyServer(proxy);
    }
    return next();
  }

  async onUnexpectedShutdown(driver: any, cause: any) {
    const sessions = Object.keys(driver.sessions || {});
    for (const sessionId of sessions) {
      const proxy = proxyCache.get(sessionId);
      if (proxy) {
        const adb = driver.sessions[sessionId]?.adb;
        await configureWifiProxy(adb, proxy.deviceUDID, false);
        await cleanUpProxyServer(proxy);
      }
    }
  }

  async addMock(next: any, driver: any, config: MockConfig) {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }

    sanitizeMockConfig(config);
    return proxy?.addMock(config);
  }

  async removeMock(next: any, driver: any, id: any) {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }

    proxy.removeMock(id);
  }

  async execute(next: any, driver: any, script: any, args: any) {
    return await this.executeMethod(next, driver, script, args);
  }
}
