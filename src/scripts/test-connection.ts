import ADB from 'appium-adb';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
//@ts-ignore
import { Select } from 'enquirer';
import { ADBInstance, UDID, configureWifiProxy, isRealDevice, openUrl } from '../utils/adb';
import { v4 as uuid } from 'uuid';
import { setupProxyServer } from '../utils/proxy';
import { Proxy } from '../proxy';
import path from 'path';

type VerifyOptions = {
  udid: string;
  certdirectory: string;
};

const defaultOptions: VerifyOptions = {
  udid: '',
  certdirectory: path.join(__dirname, '..', 'certificate'),
};

const MOCK_BACKEND_HTML = `<html><head><title>Appium Mock</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center">
<h1>Hurray</h1>
<p style="font-size:30px">Your device is successfully connected to appium interceptor plugin</p>
</body></html>`;

//Adding a random version to make sure browser doensn't cache the response
const MOCK_BACKEND_URL = `https://www.appiumproxy.io?version=${uuid()}`;

function getOptions() {
  const cliOptions = yargs(hideBin(process.argv)).argv;
  Object.assign(defaultOptions, cliOptions);
  return defaultOptions;
}

async function getDeviceFromUser(devices: Array<{ udid: string }>) {
  const prompt = new Select({
    name: 'device',
    message: 'Pick a device to validate connection',
    choices: devices.map((d) => d.udid),
  });

  try {
    const answer = await prompt.run();
    return answer;
  } catch (err) {
    return null;
  }
}

async function pickDeviceToTest(adb: ADBInstance, options: VerifyOptions) {
  const devices = await adb.getConnectedDevices();
  let deviceToUse;
  if (!devices.length) {
    throw new Error('No android device found.');
  } else if (devices.length == 1) {
    deviceToUse = devices[0]?.udid;
  } else if (!options.udid && devices.length > 1) {
    deviceToUse = await getDeviceFromUser(devices);
  }

  if (options.udid) {
    deviceToUse = devices.find((device) => device.udid == options.udid)?.udid;
  }

  if (!deviceToUse) {
    throw new Error(`Device ${options.udid} not found`);
  }

  return deviceToUse;
}

async function addMock(proxy: Proxy) {
  proxy.addMock({
    url: '/appiumproxy.io/g',
    responseBody: MOCK_BACKEND_HTML,
    statusCode: 200,
  });
}

async function verifyDeviceConnection(adb: ADBInstance, udid: UDID, certDirectory: string) {
  const realDevice = await isRealDevice(adb, udid);
  const proxy = await setupProxyServer(uuid(), udid, realDevice, certDirectory);
  addMock(proxy);
  await configureWifiProxy(adb, udid, realDevice, proxy.options);
  await openUrl(adb, udid, MOCK_BACKEND_URL);
}

async function registerExitHook(adb: ADBInstance, udid: UDID) {
  const exitHook = async () => {
    if (adb && udid) {
      await configureWifiProxy(adb, udid, false);
    }
  };

  process.once('beforeExit', exitHook);
  process.once('SIGINT', exitHook);
  process.once('SIGTERM', exitHook);
  process.once('exit', exitHook);
}

async function main() {
  const adb = await ADB.createADB({});
  const options = getOptions();
  const udid = await pickDeviceToTest(adb, options);
  await registerExitHook(adb, udid);
  await verifyDeviceConnection(adb, udid, options.certdirectory);
}

main().catch(console.log);
