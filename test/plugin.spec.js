import { remote } from 'webdriverio';
import { API_DEMOS_APK_PATH as apidemosApp } from 'android-apidemos';
import { expect } from 'chai';

const APPIUM_HOST = '127.0.0.1';
const APPIUM_PORT = 4723;
const WDIO_PARAMS = {
  connectionRetryCount: 0,
  hostname: APPIUM_HOST,
  port: APPIUM_PORT,
  path: '/wd/hub/',
  logLevel: 'info',
};
const capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UIAutomator2',
  'appium:app': apidemosApp,
  'appium:intercept': true,
};
let driver;
describe('Plugin Test', () => {
  beforeEach(async () => {
    driver = await remote({ ...WDIO_PARAMS, capabilities });
  });

  it('Vertical swipe test', async () => {
    const mockId = await driver.execute('interceptor: addMock', {
      config: {
        url: 'https://jsonplaceholder.typicode.com/todos/1',
      },
    })
    expect(mockId).to.not.be.null
  });
  afterEach(async () => {
    await driver.deleteSession();
  });
});
