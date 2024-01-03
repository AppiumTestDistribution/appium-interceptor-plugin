import ADB from 'appium-adb';
import { Proxy } from '../proxy';

export async function getDeviceProperty(
  adbInstance: any,
  udid: string,
  prop: string
): Promise<string | undefined> {
  try {
    return await adbInstance.adbExec(['-s', udid, 'shell', 'getprop', prop]);
  } catch (error) {
    throw new Error(`Error while getting device property "${prop}" for ${udid}. Error: ${error}`);
  }
}

export async function isRealDevice(adb: ADB, deviceUDID: string) {
  const property = await getDeviceProperty(adb, deviceUDID, 'ro.build.characteristics');
  return property !== 'emulator';
}

export async function configureWifiProxy(
  adb: ADB,
  deviceUDID: string,
  isRealDevice: boolean,
  proxy?: Proxy
) {
  try {
    const host = !proxy ? ':0' : `${proxy.getIp()}:${proxy.getPort()}`;
    if (isRealDevice && proxy) {
      await adb.adbExec([
        '-s',
        deviceUDID,
        'reverse',
        `tcp:${proxy.getPort()}`,
        `tcp:${proxy.getPort()}`,
      ]);
    }
    return await adb.adbExec([
      '-s',
      deviceUDID,
      'shell',
      'settings',
      'put',
      'global',
      'http_proxy',
      host,
    ]);
  } catch (error) {
    throw new Error(`Unable to set wifi proxy settings to device. ${error}`);
  }
}
