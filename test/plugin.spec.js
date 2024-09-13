import { remote } from 'webdriverio';
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
  'appium:app': './assets/test_app_mitm_proxy.apk',
  'appium:intercept': true,
};
let driver;
describe('Plugin Test', () => {
  beforeEach(async () => {
    driver = await remote({ ...WDIO_PARAMS, capabilities });
  });

  it('Should be able to mock entire response body', async () => {
    const mockId = await driver.execute('interceptor: addMock', {
      config: {
        url: '/api/users?.*',
        responseBody: JSON.stringify({
          page: 1,
          per_page: 6,
          total: 12,
          total_pages: 2,
          data: [
            {
              id: 1,
              email: 'saikrishna.bluth@reqres.in',
              first_name: 'George',
              last_name: 'Bluth',
              avatar: 'https://reqres.in/img/faces/1-image.jpg',
            },
            {
              id: 2,
              email: 'janet.weaver@reqres.in',
              first_name: 'Janet',
              last_name: 'Weaver',
              avatar: 'https://reqres.in/img/faces/2-image.jpg',
            },
            {
              id: 3,
              email: 'emma.wong@reqres.in',
              first_name: 'Emma',
              last_name: 'Wong',
              avatar: 'https://reqres.in/img/faces/3-image.jpg',
            },
            {
              id: 4,
              email: 'eve.holt@reqres.in',
              first_name: 'Eve',
              last_name: 'Holt',
              avatar: 'https://reqres.in/img/faces/4-image.jpg',
            },
            {
              id: 5,
              email: 'charles.morris@reqres.in',
              first_name: 'Charles',
              last_name: 'Morris',
              avatar: 'https://reqres.in/img/faces/5-image.jpg',
            },
            {
              id: 6,
              email: 'tracey.ramos@reqres.in',
              first_name: 'Tracey',
              last_name: 'Ramos',
              avatar: 'https://reqres.in/img/faces/6-image.jpg',
            },
          ],
          support: {
            url: 'https://reqres.in/#support-heading',
            text: 'To keep ReqRes free, contributions towards server costs are appreciated!',
          },
        }),
      },
    });
    expect(mockId).to.not.be.null;
    const el1 = await driver.$('xpath://android.widget.TextView[@text="Get User List"]');
    await el1.click();
    const page = await driver.getPageSource();
    expect(page.includes('saikrishna.bluth@reqres.in')).to.be.true;
  });

  it('Should be able to mock partial response body', async () => {
    const mockId = await driver.execute('interceptor: addMock', {
      config: {
        url: '/api/users?.*',
        updateResponseBody: [
          {
            jsonPath: '$.data[?(/tracey.*/.test(@.email))].first_name',
            value: 'sudharsan',
          },
          {
            jsonPath: '$.data[?(/tracey.*/.test(@.email))].last_name',
            value: 'selvaraj',
          },
        ],
      },
    });
    expect(mockId).to.not.be.null;
    const el1 = await driver.$('xpath://android.widget.TextView[@text="Get User List"]');
    await el1.click();
    const page = await driver.getPageSource();
    expect(page.includes('sudharsan')).to.be.true;
    expect(page.includes('selvaraj')).to.be.true;
  });

  it('Should be able to mock status code', async () => {
    const mockId = await driver.execute('interceptor: addMock', {
      config: {
        url: '/api/users?.*',
        statusCode: 400,
      },
    });
    expect(mockId).to.not.be.null;
    const el1 = await driver.$('xpath://android.widget.TextView[@text="Get User List"]');
    await el1.click();
    const page = await driver.getPageSource();
    expect(page.includes('Error')).to.be.true;
  });

  afterEach(async () => {
    await driver.deleteSession();
  });
});
