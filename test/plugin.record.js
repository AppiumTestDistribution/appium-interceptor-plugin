import { remote } from 'webdriverio';
import { expect } from 'chai';
import fs from 'fs';

const APPIUM_HOST = '127.0.0.1';
const APPIUM_PORT = 4723;
const APK_PATH = '/Users/anikmukh/StudioProjects/user_management_app/build/app/outputs/flutter-apk/app-debug.apk';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UIAutomator2',
  'appium:app': APK_PATH,
  'appium:intercept': true,
};

const wdOpts = {
  hostname: APPIUM_HOST,
  port: APPIUM_PORT,
  path: '/',
  logLevel: 'info',
  capabilities,
};

let driver;

describe('Different APK Plugin Test', function() {
  this.timeout(30000); // Extend timeout if necessary

  beforeEach(async function() {
    driver = await remote(wdOpts);
  });

  it('Should handle multiple clicks and start/stop recording', async function() {
    await sleep(5000);
    
    await driver.execute("interceptor: startListening", {
      config: {
        include: {
          url: "/api/users?.*/g"
        }
      }
    });    
    
    const el1 = await driver.$('//android.widget.Button[@content-desc="Get User List"]');
    await el1.click();
    
    await sleep(2000);
    
    const el2 = await driver.$('//android.widget.Button[@content-desc="Back"]');
    await el2.click();
    
    const recordedData = await driver.execute('interceptor: stopListening');
    // const jsonString = JSON.stringify(recordedData, null, 2);
    console.log(recordedData);

    // Write the JSON string to a file
    // fs.writeFileSync('./recordedData.json', jsonString, 'utf8');
    
  });

  afterEach(async function() {
    await driver.pause(1000);
    await driver.deleteSession();
  });
});
