import { remote } from "webdriverio";
import { API_DEMOS_APK_PATH as apidemosApp } from "android-apidemos";

const APPIUM_HOST = "127.0.0.1";
const APPIUM_PORT = 4723;
const WDIO_PARAMS = {
  connectionRetryCount: 0,
  hostname: APPIUM_HOST,
  port: APPIUM_PORT,
  path: "/wd/hub/",
  logLevel: "info",
};
const capabilities = {
  platformName: "Android",
  "appium:automationName": "espresso",
  "appium:app": apidemosApp,
  "appium:forceEspressoRebuild": false,
  "appium:showGradleLog": true,
};
let driver;
describe("Plugin Test", () => {
  beforeEach(async () => {
    driver = await remote({ ...WDIO_PARAMS, capabilities });
  });

  it("Vertical swipe test", async () => {
    await driver.$("~Animation");
  });
  afterEach(async () => {
    await driver.quit();
  });
});
