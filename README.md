# appium-interceptor-plugin

This is an Appium plugin designed to intercept API response and mocking easy.
This plugin uses `mitmproxy`.

## Prerequisite

1. Appium version 3.0
2. Intercepting API requests from android requires CA certificate to be installed on the device. Follow the instructions in [How to install CA certificate on android](./docs/certificate-installation.md) section and install the CA certificate.

## Installation - server

Install the plugin using Appium's plugin CLI, either as a named plugin or via NPM:

```shell
appium plugin install --source=npm appium-interceptor
```

## Activation

The plugin will not be active unless turned on when invoking the Appium server:

`appium server -ka 800 --use-plugins=appium-interceptor -pa /wd/hub`

## What does this plugin do?

The **Appium Interceptor Plugin** provides network interception and mocking capabilities specifically for **Android** devices. It manages a local proxy server and automatically configures the device's WiFi settings to route all network traffic through it.

By using this plugin, you can intercept, record, and mock HTTP requests directly within your Appium tests without manually configuring certificates or proxy settings on the device.

## Configuration

### Server Arguments

#### 👉 Custom certificate

If you need to use a custom certificate, it can be done by passing `certdirectory` as an argument of the plugin:

`appium server -ka 800 --use-plugins=appium-interceptor --plugin-appium-interceptor-certdirectory="<path_to_cert_directory>" -pa /wd/hub`

Please keep the same directory structure as the existing certificate folder.

#### 👉 Whitelist/Blacklist

If you need to limit the calls going through the proxy, it can be done by passing `whitelisteddomains` and `blacklisteddomains` as an argument of the plugin:

Example of `whitelisteddomains`: only the calls for the domain `*.mydomain.com` got through the proxy.

`appium server -ka 800 --use-plugins=appium-interceptor --plugin-appium-interceptor-whitelisteddomains='["*.mydomain.com"]' -pa /wd/hub`

Example of `blacklisteddomains`: all the calls go through the proxy, except the calls for `*.otherdomain.com`.

`appium server -ka 800 --use-plugins=appium-interceptor --plugin-appium-interceptor-blacklisteddomains='["*.otherdomain.com"]' -pa /wd/hub`

Note: `whitelisteddomains` and `blacklisteddomains` are two different approach and are not supposed to be used together. If both are present, `blacklisteddomains` will be ignored.

### Capabilities

To control the plugin behavior, you can use the following capabilities:

| Capability                       | Type      | Default | Description                                                                                                              |
| :------------------------------- | :-------- | :------ | :----------------------------------------------------------------------------------------------------------------------- |
| `appium:startProxyAutomatically` | `boolean` | `false` | When `true`, the plugin initializes the proxy server and configures the device WiFi immediately during session creation. |

---

## Usages

### 1. Automatic lifecycle management

Set `appium:startProxyAutomatically` to `true` in your capabilities. The plugin will handle the proxy **setup** during session creation and the proxy **cleanup** (reverting WiFi settings and closing the server) when the session ends.

```javascript
// Example with WebdriverIO
const caps = {
  "platformName": "Android",
  "appium:automationName": "UiAutomator2",
  "appium:startProxyAutomatically": true
};
```

### 2. Manual management

If you want to control exactly when the proxy starts (e.g., only for specific test cases), leave the capability at `false` and use the following commands within your test scripts:

* **Start Proxy**: `driver.execute('interceptor: startProxy')`
* **Stop Proxy**: `driver.execute('interceptor: stopProxy')`

> **Pro tip for troubleshooting**: These commands can be useful for **on-the-fly recovery** during a test session. If you encounter a network glitch or a proxy timeout, you can manually call `stopProxy` followed by `startProxy` to perform a "clean restart" without terminating your entire Appium session.
  
> **Note**: Even in manual mode, the plugin **automatically handles the cleanup** when the session ends. 
> Unlike a simple deactivation, the plugin **restores your previous device settings** (such as your original global proxy configuration) instead of just wiping them. This ensures your device returns exactly to the state it was in before the test started.

## Usable commands

Please refer to the [commands](/docs/commands.md) sections for detailed usage.


## Logging & debugging

The plugin integrates with the standard Appium logging system. For deep troubleshooting, set the server log level to `debug`:

```json
{
  "server": {
    "log-level": "debug:debug"
  }
}
```


## Supported Platforms

💚 `Android`

**Mocking support**

1. Update outgoing request URL
2. Fully Replace or partially modify the request payload (POST Body)
3. Update the request headers
4. Update the response headers
5. Fully Replace or partially modify the response body
6. Update the response status code.

## Usage

Refer Examples [here](./test/plugin.spec.js)

## Troubleshooting

In certain instances where the session terminates abruptly, the device proxy state may persist without being cleared, leading to a non-functional network connection. To rectify this issue and reset the device proxy state, execute the following adb command.

`adb shell settings put global http_proxy :0` 

## Build local

`npm install`

`npm run build`

## Credits

A special thanks to creators and maintainers of [node-http-mitm-proxy](https://github.com/joeferner/node-http-mitm-proxy). Their efforts have laid the foundation for the capabilities embedded in this plugin.
