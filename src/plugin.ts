import { BasePlugin } from 'appium/plugin';
import http from 'http';
import { Application } from 'express';
import { CliArg, ISessionCapability, MockConfig, RecordConfig, RequestInfo, ReplayConfig, SniffConfig } from './types';
import _ from 'lodash';
import { configureWifiProxy, isRealDevice } from './utils/adb';
import { cleanUpProxyServer, sanitizeMockConfig, setupProxyServer } from './utils/proxy';
import proxyCache from './proxy-cache';
import logger from './logger';
import log from './logger';

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

    'interceptor: disableMock': {
      command: 'disableMock',
      params: { required: ['id'] },
    },

    'interceptor: enableMock': {
      command: 'enableMock',
      params: { required: ['id'] },
    },

    'interceptor: startListening': {
      command: 'startListening',
      params: { optional: ['config'] },
    },

    'interceptor: stopListening': {
      command: 'stopListening',
      params: { optional: ['id'] },
    },

    'interceptor: startRecording': {
      command: 'startRecording',
      params: { optional: ['config'] },
    },

    'interceptor: stopRecording': {
      command: 'stopRecording',
      params: { optional: ['id'] },
    },

    'interceptor: startReplaying': {
      command: 'startReplaying',
      params: { required: ['replayConfig'] },
    },

    'interceptor: stopReplaying': {
      command: 'stopReplaying',
      params: { optional: ['id'] },
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
      if(!adb) {
        log.info(`Unable to find adb instance from session ${sessionId}. So skipping api interception.`);
        return response;
      }
      const realDevice = await isRealDevice(adb, deviceUDID);
      const proxy = await setupProxyServer(sessionId, deviceUDID, realDevice);
      await configureWifiProxy(adb, deviceUDID, realDevice, proxy);
      proxyCache.add(sessionId, proxy);
    }
    log.info("Creating session for appium interceptor");
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

  async disableMock(next: any, driver: any, id: any) {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }

    proxy.disableMock(id);
  }

  async enableMock(next: any, driver: any, id: any) {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }

    proxy.enableMock(id);
  }

  async startListening(next: any, driver: any, config: SniffConfig): Promise<string> {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }

    log.info(`Adding listener with config ${config}`);
    return proxy?.addSniffer(config);
  }

  async stopListening(next: any, driver: any, id: any): Promise<RequestInfo[]> {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }

    log.info(`Stopping listener with id: ${id}`);
    return proxy.removeSniffer(false, id);
  }

  async startRecording(next: any, driver: any, config: SniffConfig): Promise<string> {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }

    log.info(`Adding listener with config ${config}`);
    return proxy?.addSniffer(config);
  }

  async stopRecording(next: any, driver: any, id: any): Promise<RecordConfig[]> {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }

    log.info(`Stopping recording with id: ${id}`);
    return proxy.removeSniffer(true, id);
  }

  async startReplaying(next:any, driver:any, replayConfig: ReplayConfig) {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }
    log.info('Starting replay traffic');
    proxy.startReplaying();
    return proxy.getRecordingManager().replayTraffic(replayConfig);
  }

  async stopReplaying(next: any, driver:any, id:any) {
    const proxy = proxyCache.get(driver.sessionId);
    if (!proxy) {
      logger.error('Proxy is not running');
      throw new Error('Proxy is not active for current session');
    }
    log.info("Initiating stop replaying traffic");
    proxy.getRecordingManager().stopReplay(id);
  }

  async execute(next: any, driver: any, script: any, args: any) {
    return await this.executeMethod(next, driver, script, args);
  }
}