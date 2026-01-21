import { BasePlugin } from 'appium/plugin';
import http from 'http';
import { Application } from 'express';
import _ from 'lodash';

import {
  CliArg,
  ISessionCapability,
  MockConfig,
  RecordConfig,
  RequestInfo,
  ReplayConfig,
  SniffConfig,
} from './types';
import { DefaultPluginArgs, IPluginArgs } from './interfaces';
import {
  configureWifiProxy,
  isRealDevice,
  getAdbReverseTunnels,
  getCurrentWifiProxyConfig,
  ADBInstance,
  UDID,
} from './utils/adb';
import { cleanUpProxyServer, parseJson, sanitizeMockConfig, setupProxyServer } from './utils/proxy';
import proxyCache from './proxy-cache';
import log from './logger';

export class AppiumInterceptorPlugin extends BasePlugin {
  private pluginArgs: IPluginArgs = Object.assign({}, DefaultPluginArgs);

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
    'interceptor: getInterceptedData': {
      command: 'getInterceptedData',
      params: { optional: ['id'] },
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

    'interceptor: getProxyState': {
      command: 'getProxyState',
    },
    'interceptor: startProxy': {
      command: 'startProxy',
    },
    'interceptor: stopProxy': {
      command: 'stopProxy',
    },
  };

  constructor(name: string, cliArgs: CliArg) {
    super(name, cliArgs);
    log.debug(`📱 Initializing plugin with CLI args: ${JSON.stringify(cliArgs)}`);
    this.pluginArgs = Object.assign({}, DefaultPluginArgs, cliArgs as unknown as IPluginArgs);
  }

  /**
   * Static method called by Appium at server startup.
   * Can be used to extend the Express server with new routes.
   */
  static async updateServer(expressApp: Application, httpServer: http.Server, cliArgs: CliArg) {}

  async createSession(
    next: () => any,
    driver: any,
    jwpDesCaps: any,
    jwpReqCaps: any,
    caps: ISessionCapability,
  ) {
    const response = await next();

    // Early return if session creation failed at driver level
    if ((response.value && response.value.error) || response.error) {
      log.warn('Session creation failed. Skipping interceptor setup.');
      return response;
    }

    const mergedCaps = { ...caps.alwaysMatch, ..._.get(caps, 'firstMatch[0]', {}) };
    const startProxyAutomatically = mergedCaps['appium:startProxyAutomatically'] === true;
    const [sessionId, sessionCaps] = response.value;
    const { deviceUDID, platformName } = sessionCaps;
    const adb = driver.sessions[sessionId]?.adb;

    // Platform validation (Android only)
    if (platformName?.toLowerCase().trim() !== 'android') {
      log.warn(
        `Platform '${platformName}' is not supported. Appium interceptor plugin only supports Android. Skipping interceptor setup.`,
      );
      return response;
    }

    if (!adb) {
      throw log.errorWithException(
        `[${sessionId}] Unable to find ADB instance. API interception cannot be initialized.`,
      );
    }

    if (startProxyAutomatically) {
      log.debug(
        `[${sessionId}] Capability 'startProxyAutomatically' is enabled. Initializing proxy setup...`,
      );
      await this.setupProxy(adb, sessionId, deviceUDID);
    } else {
      log.debug(
        `[${sessionId}] Capability 'startProxyAutomatically' is disabled. Use command 'startProxy' to start proxy.`,
      );
    }

    return response;
  }

  async deleteSession(next: () => any, driver: any, sessionId: string) {
    log.debug(`[${sessionId}] Deleting session. Starting proxy cleanup...`);
    const adb = driver.sessions[sessionId]?.adb;
    await this.clearProxy(adb, sessionId);
    return next();
  }

  async onUnexpectedShutdown(driver: any, cause: any) {
    log.error(
      `Unexpected shutdown detected (Cause: ${cause}). Cleaning up all active proxy sessions...`,
    );
    const sessions = Object.keys(driver.sessions || {});
    for (const sessionId of sessions) {
      const adb = driver.sessions[sessionId]?.adb;
      await this.clearProxy(adb, sessionId);
    }
  }

  async addMock(_next: any, driver: any, config: MockConfig) {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Registering new mock rule (config=${JSON.stringify(config)})`);
    sanitizeMockConfig(config);
    return proxy.addMock(config);
  }

  async removeMock(_next: any, driver: any, id: string) {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Removing mock rule with ID: ${id}`);
    proxy.removeMock(id);
  }

  async disableMock(_next: any, driver: any, id: string) {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Disabling mock rule with ID: ${id}`);
    proxy.disableMock(id);
  }

  async enableMock(_next: any, driver: any, id: string) {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Enabling mock rule with ID: ${id}`);
    proxy.enableMock(id);
  }

  async startListening(_next: any, driver: any, config: SniffConfig): Promise<string> {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Starting network listener (config=${JSON.stringify(config)})`);
    return proxy.addSniffer(config);
  }

  async getInterceptedData(_next: any, driver: any, id: string): Promise<RequestInfo[]> {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Fetching intercepted data for listener with ID: ${id}`);
    return proxy.getInterceptedData(false, id);
  }

  async stopListening(_next: any, driver: any, id: string): Promise<RequestInfo[]> {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Stopping network listener with ID: ${id}`);
    return proxy.removeSniffer(false, id);
  }

  async startRecording(_next: any, driver: any, config: SniffConfig): Promise<string> {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Starting traffic recording`);
    return proxy.addSniffer(config);
  }

  async stopRecording(_next: any, driver: any, id: string): Promise<RecordConfig[]> {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Stopping traffic recording for listener with ID: ${id}`);
    return proxy.removeSniffer(true, id);
  }

  async startReplaying(_next: any, driver: any, replayConfig: ReplayConfig) {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Starting traffic replay`);
    proxy.startReplaying();
    return proxy.getRecordingManager().replayTraffic(replayConfig);
  }

  async stopReplaying(_next: any, driver: any, id: string) {
    const proxy = this.getSessionProxy(driver.sessionId);
    log.debug(`[${driver.sessionId}] Stopping traffic replay`);
    proxy.getRecordingManager().stopReplay(id);
  }

  async execute(next: any, driver: any, script: string, args: any) {
    return await this.executeMethod(next, driver, script, args);
  }

  async startProxy(_next: any, driver: any) {
    await this.setupProxy(driver.adb, driver.sessionId, driver.adb?.curDeviceId);
  }

  async stopProxy(_next: any, driver: any) {
    await this.clearProxy(driver.adb, driver.sessionId);
  }

  private getSessionProxy(sessionId: string) {
    log.debug(`getSessionProxy(sessionId=${sessionId})`);
    const proxy = proxyCache.get(sessionId);
    if (!proxy) {
      throw log.errorWithException(
        `No active proxy found for session ${sessionId}. Please call 'startProxy' first.`,
      );
    }
    return proxy;
  }

  private async setupProxy(adb: ADBInstance, sessionId: string, deviceUDID: UDID) {
    log.debug(`setupProxy(sessionId=${sessionId}, deviceUDID:${deviceUDID})`);

    if (proxyCache.get(sessionId)) {
      log.warn(`[${sessionId}] A proxy is already active for this session. Skipping setup.`);
      return;
    }

    if (!adb) throw log.errorWithException('Proxy setup failed: ADB instance is missing.');
    if (!sessionId) throw log.errorWithException('Proxy setup failed: Session ID is missing.');
    if (!deviceUDID) throw log.errorWithException('Proxy setup failed: Device UDID is missing.');

    try {
      const realDevice = await isRealDevice(adb, deviceUDID);
      const currentGlobalProxy = await getCurrentWifiProxyConfig(adb, deviceUDID);
      const whitelistedDomains = ((domains) =>
        Array.isArray(domains) ? domains : typeof domains === 'string' ? [domains] : [])(
        typeof this.pluginArgs.whitelisteddomains === 'string'
          ? parseJson(this.pluginArgs.whitelisteddomains)
          : this.pluginArgs.whitelisteddomains,
      );
      const blacklistedDomains = ((domains) =>
        Array.isArray(domains) ? domains : typeof domains === 'string' ? [domains] : [])(
        typeof this.pluginArgs.blacklisteddomains === 'string'
          ? this.pluginArgs.blacklisteddomains
          : parseJson(this.pluginArgs.blacklisteddomains),
      );
      const upstreamProxy =
        typeof this.pluginArgs.upstreamproxy === 'string' &&
        this.pluginArgs.upstreamproxy.trim().length > 0
          ? this.pluginArgs.upstreamproxy.trim()
          : null;
      const proxy = await setupProxyServer(
        sessionId,
        deviceUDID,
        realDevice,
        this.pluginArgs.certdirectory,
        currentGlobalProxy,
        whitelistedDomains,
        blacklistedDomains,
        upstreamProxy,
      );

      await configureWifiProxy(adb, deviceUDID, realDevice, proxy.options);

      proxyCache.add(sessionId, proxy);
      log.debug(
        `[${sessionId}] Proxy successfully registered (ip=${proxy.options.ip}, port=${proxy.options.port}).`,
      );
    } catch (err: any) {
      throw log.errorWithException(`[${sessionId}] Failed to initialize proxy: ${err.message}`);
    }
  }

  private async clearProxy(adb: ADBInstance, sessionId: string) {
    const proxy = proxyCache.get(sessionId);
    if (!proxy) {
      log.debug(`[${sessionId}] No proxy registered for this session. Nothing to clear.`);
      return;
    }

    log.debug(`[${sessionId}] Reverting device settings and cleaning up proxy resources...`);

    try {
      // Revert WiFi settings to previous state or off
      await configureWifiProxy(adb, proxy.options.deviceUDID, false, proxy.previousGlobalProxy);
      // Shutdown the local proxy server
      await cleanUpProxyServer(proxy);
      proxyCache.remove(sessionId);
      log.debug(`[${sessionId}] Proxy cleanup successful.`);
    } catch (err: any) {
      // Log the error but do not block the session deletion process
      log.error(`[${sessionId}] Critical error during proxy cleanup: ${err.message}`);
    }
  }

  /**
   * Aggregates the current health and configuration state of the proxy system.
   * * This method performs a dual-layer diagnostic:
   * 1. Host Layer: Checks if the proxy instance exists in the cache and verifies its execution status.
   * 2. Transport Layer: Queries the physical device via ADB to list active reverse tunnels.
   * * It is primarily used to determine if a connectivity issue originates from the
   * Node.js server (Host) or the ADB bridge/USB connection (Device).
   *
   * @param next - The next middleware or handler in the execution chain (if applicable).
   * @param driver - The Appium driver instance containing the ADB controller and session ID.
   * @returns A Promise resolving to a JSON string representing the combined state of the proxy and ADB tunnels.
   */
  async getProxyState(next: any, driver: any): Promise<string> {
    const adb = driver.adb;
    const udid = adb.curDeviceId;
    const adbReverseTunnels = await getAdbReverseTunnels(adb, udid);
    const proxy = proxyCache.get(driver.sessionId);
    const proxyServerStatus = {
      isRegistered: !!proxy,
      isStarted: proxy ? proxy.isStarted() : false,
      ...proxy?.options,
    };
    const adbDeviceStatus = {
      udid: udid,
      activeAdbReverseTunnels: adbReverseTunnels,
    };
    const proxyState = {
      proxyServerStatus: proxyServerStatus,
      adbDeviceStatus: adbDeviceStatus,
    };
    return JSON.stringify(proxyState);
  }
}
