import ADB from 'appium-adb';
import { Proxy, ProxyOptions } from '../proxy';
import logger from '../logger';

export type ADBInstance = ADB;
export type UDID = string;

async function adbExecWithDevice(adb: ADBInstance, udid: UDID, args: string[]): Promise<string> {
  return adb.adbExec(['-s', udid, ...args]);
}

export async function getDeviceProperty(
  adb: ADBInstance,
  udid: UDID,
  prop: string,
): Promise<string | undefined> {
  try {
    return await adbExecWithDevice(adb, udid, ['shell', 'getprop', prop]);
  } catch (error: any) {
    throw new Error(`Error getting device property "${prop}" for ${udid}: ${error.message}`);
  }
}

export async function isRealDevice(adb: ADBInstance, udid: UDID): Promise<boolean> {
  const property = await getDeviceProperty(adb, udid, 'ro.build.characteristics');
  return property !== 'emulator';
}

/**
 * Configures the global HTTP proxy settings for Wi-Fi traffic on the target Android device via ADB.
 * If a valid proxy configuration is provided:
 * 1. It sets up an 'adb reverse' tunnel for real devices to ensure the device can reach the host-side proxy.
 * 2. It sets the 'http_proxy' global setting to 'IP:PORT'.
 * If the configuration is invalid or missing, it sets the 'http_proxy' to ':0' (which disables the proxy).
 *
 * @param adb - The ADB instance established by Appium.
 * @param udid - The Unique Device Identifier (UDID) of the Android device or emulator.
 * @param isRealDevice - Boolean indicating if the target is a physical device (requires adb reverse).
 * @param proxyConfig - Optional configuration object containing the IP and port for the proxy.
 * @returns A Promise resolving to the output of the final ADB shell command.
 * @throws {Error} Throws an error if any ADB command execution fails.
 */
export async function configureWifiProxy(
  adb: ADBInstance,
  udid: UDID,
  isRealDevice: boolean,
  proxyConfig?: ProxyOptions,
): Promise<string> {
  logger.info(
    `configureWifiProxy(udid=${udid}, isRealDevice=${isRealDevice}, proxyConfig=${JSON.stringify(proxyConfig)})`,
  );
  try {
    const isConfigValid =
      proxyConfig &&
      proxyConfig.ip &&
      proxyConfig.ip.trim().length > 0 &&
      !isNaN(proxyConfig.port) &&
      proxyConfig.port > 0;

    if (!isConfigValid) {
      logger.warn(
        `Invalid proxy config: ${JSON.stringify(proxyConfig)}. Proxy will be disabled for udid ${udid}.`,
      );
    }

    const host = isConfigValid ? `${proxyConfig.ip}:${proxyConfig.port}` : ':0';

    if (isRealDevice && isConfigValid) {
      await adbExecWithDevice(adb, udid, [
        'reverse',
        `tcp:${proxyConfig.port}`,
        `tcp:${proxyConfig.port}`,
      ]);
    }

    return await adbExecWithDevice(adb, udid, [
      'shell',
      'settings',
      'put',
      'global',
      'http_proxy',
      host,
    ]);
  } catch (error: any) {
    throw new Error(`Error setting wifi proxy for ${udid}: ${error.message}`);
  }
}

/**
 * Retrieves the current global HTTP proxy settings from the target Android device via ADB.
 * The function checks the 'http_proxy' setting in the 'global' namespace of the Android system settings.
 *
 * @param adb - The ADB instance established by Appium.
 * @param udid - The Unique Device Identifier (UDID) of the Android device or emulator.
 * @returns A Promise resolving to an object containing the IP and port of the proxy
 * ({ ip: string, port: number }), or undefined if no proxy is configured,
 * or if the configuration is invalid (e.g., malformed port).
 * @throws {Error} Throws an error if the ADB command execution fails.
 */
export async function getCurrentWifiProxyConfig(
  adb: ADBInstance,
  udid: UDID,
): Promise<ProxyOptions | undefined> {
  logger.info(`getCurrentWifiProxyConfig(udid=${udid})`);
  try {
    // Execute ADB command to get the current global HTTP proxy setting
    const proxySettingsCommandResult = await adbExecWithDevice(adb, udid, [
      'shell',
      'settings',
      'get',
      'global',
      'http_proxy',
    ]);

    // ADB returns ":0" or "null" when the proxy is disabled.
    if (
      !proxySettingsCommandResult ||
      proxySettingsCommandResult === ':0' ||
      proxySettingsCommandResult === 'null'
    ) {
      logger.info(`No active proxy for udid ${udid}.`);
      return undefined;
    }

    // Ensure the format is IP:PORT (must contain at least one ':').
    if (!proxySettingsCommandResult.includes(':')) {
      logger.warn(
        `Invalid proxy settings format detected for udid ${udid}: '${proxySettingsCommandResult}'.`,
      );
      return undefined;
    }

    // Split the string into IP and port
    const [ip, portStr] = proxySettingsCommandResult.split(':', 2);
    const port = Number(portStr);

    // Validate IP and port values.
    // IP should not be empty after trimming, and port must be a valid number greater than 0.
    if (!ip.trim() || isNaN(port) || port <= 0) {
      logger.warn(`Invalid proxy settings detected for udid ${udid}: (ip=${ip}, port=${port})`);
      return undefined;
    }

    const proxyOptions: ProxyOptions = {
      ip: ip.trim(),
      port: port,
    } as ProxyOptions;

    logger.info(`Found active proxy for udid ${udid}: ${JSON.stringify(proxyOptions)}`);
    return proxyOptions;
  } catch (error: any) {
    throw new Error(`Error getting wifi proxy settings for ${udid}: ${error.message}`);
  }
}

/**
 * Retrieves the list of all active ADB reverse port forwardings for a specific device.
 * * This method executes 'adb reverse --list' to identify which device ports are
 * currently bridged to the host machine. It is essential for diagnosing
 * connectivity between the mobile device and local proxy servers.
 *
 * @param adb - The ADB instance provided by the Appium driver.
 * @param udid - The Unique Device Identifier (UDID) of the target Android device.
 * @returns A Promise resolving to the raw string output of the 'adb reverse --list' command.
 * @throws {Error} If the command fails to execute or the device is unreachable.
 */
export async function getAdbReverseTunnels(adb: ADBInstance, udid: UDID): Promise<string> {
  try {
    return await adbExecWithDevice(adb, udid, ['reverse', '--list']);
  } catch (error: any) {
    throw new Error(`Failed to list active reverse tunnels for device ${udid}: ${error.message}`);
  }
}

/**
 * Removes a specific reverse tunnel established on the device for the given port.
 * * Note: While the reverse tunnel is automatically created within the
 * `configureWifiProxy` method (for real devices), ADB reverse tunnels are
 * not automatically closed when a test session ends.
 * * Since `configureWifiProxy` establishes a bridge between the device and the
 * proxy host on a specific port, failing to clear it can lead to "Port already in use"
 * errors in subsequent sessions.
 * * @param adb - The ADB instance
 * @param udid - The device unique identifier
 * @param port - The specific port to remove from reverse tunnels
 */
export async function removeReverseTunnel(
  adb: ADBInstance,
  udid: UDID,
  port: number | string,
): Promise<string> {
  try {
    return await adbExecWithDevice(adb, udid, ['reverse', '--remove', `tcp:${port}`]);
  } catch (error: any) {
    throw new Error(`Error removing reverse tunnel for port ${port} on ${udid}: ${error.message}`);
  }
}

export async function openUrl(adb: ADBInstance, udid: UDID, url: string) {
  await adbExecWithDevice(adb, udid, [
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    url,
  ]);
}
