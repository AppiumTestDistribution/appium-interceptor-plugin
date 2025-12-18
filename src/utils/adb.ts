import ADB from 'appium-adb';
import { Proxy, ProxyOptions } from '../proxy';

export type ADBInstance = ADB;
export type UDID = string;

async function adbExecWithDevice(adb: ADBInstance, udid: UDID, args: string[]): Promise<string> {
  return adb.adbExec(['-s', udid, ...args]);
}

export async function getDeviceProperty(
  adb: ADBInstance,
  udid: UDID,
  prop: string
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

export async function configureWifiProxy(
  adb: ADBInstance,
  udid: UDID,
  realDevice: boolean,
  proxy?: ProxyOptions
): Promise<string> {
  try {
    const host = proxy ? `${proxy.ip}:${proxy.port}` : ':0';

    if (realDevice && proxy) {
      await adbExecWithDevice(adb, udid, ['reverse', `tcp:${proxy.port}`, `tcp:${proxy.port}`]);
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

export async function getGlobalProxyValue(
  adb: ADBInstance,
  udid: UDID
): Promise<ProxyOptions> {
  try {
    const proxy = await adbExecWithDevice(adb, udid, [
      'shell',
      'settings',
      'get',
      'global',
      'http_proxy'
    ])

    if(proxy == ":0" || proxy == "null") {
      return {
        port: 0
      } as ProxyOptions
    } 

    const [ip, portStr] = proxy.split(":");
    const port = Number(portStr);

    return {
      ip: ip,
      port: port
    } as ProxyOptions

  } catch (error: any) {
    throw new Error(`Error get global proxy value ${udid}: ${error.message}`);
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
export async function getAdbReverseTunnels(
  adb: ADBInstance,
  udid: UDID
): Promise<string> {
  try {
    return await adbExecWithDevice(adb, udid, [
      'reverse',
      '--list',
    ]);
  } catch(error: any) {
    throw new Error(`Failed to list active reverse tunnels for device ${udid}: ${error.message}`);
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
