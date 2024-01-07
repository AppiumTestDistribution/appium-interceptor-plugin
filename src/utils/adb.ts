import ADB from 'appium-adb';
import { Proxy } from '../proxy';

type ADBInstance = ADB;
type UDID = string;

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
  proxy?: Proxy
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
