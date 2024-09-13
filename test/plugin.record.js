import { remote } from 'webdriverio';
import path from 'path';
import fs from 'fs';

const APPIUM_HOST = '127.0.0.1';
const APPIUM_PORT = 4723;
const APK_PATH = './assets/test_app_mitm_proxy.apk';

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
  this.timeout(60000); // Extend timeout if necessary

  beforeEach(async function() {
    driver = await remote(wdOpts);
  });

  it('Should handle multiple clicks and start/stop recording', async function() {
    
    await driver.execute("interceptor: startRecording");   
    await sleep(2000); 
    
    // Loop 5 times from 0 to 4
    for (let i = 0; i < 2; i++) {
      console.log(`Click iteration: ${i + 1}`);
      
      // Perform a click action on the button
      const element = await driver.$('//android.widget.TextView[@text="Get User List"]');
      await element.click();
      await sleep(1000); // Wait between clicks if necessary
    }
    
    const recordedData = await driver.execute('interceptor: stopRecording');
    const jsonString = JSON.stringify(recordedData, null, 2);
    // console.log(recordedData);

    // Write the JSON string to a file
    fs.writeFileSync('./recordedData.json', jsonString, 'utf8');
  });

  afterEach(async function() {
    await driver.pause(1000);
    await driver.deleteSession();
  });
});