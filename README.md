# appium-interceptor-plugin

This is an Appium plugin designed to intercept API response and mocking easy.
This plugin uses mitmproxy

## Prerequisite

1. Appium version 3.0
2. Intercepting API requests from android requires CA certificate to be installed on the device. Follow the instructions in [How to install CA certificate on android](./docs/certificate-installation.md) section and install the CA certificate.

## Installation - Server

Install the plugin using Appium's plugin CLI, either as a named plugin or via NPM:

```shell
appium plugin install --source=npm appium-interceptor
```

## Activation

The plugin will not be active unless turned on when invoking the Appium server:

`appium server -ka 800 --use-plugins=appium-interceptor -pa /wd/hub`

## Custom certificate

If you need to use a custom certificate, it can be done by passing `certdirectory` as an argument of the plugin:

`appium server -ka 800 --use-plugins=appium-interceptor --plugin-appium-interceptor-certdirectory="<YOUR DIRECTORY>" -pa /wd/hub`

Please keep the same directory structure as the existing certificate folder.

## Whitelist/Blacklist

If you need to limit the calls going through the proxy, it can be done by passing `whitelisteddomains` and `blacklisteddomains` as an argument of the plugin:

Example of `whitelisteddomains`: only the call in the domain `*.mydomain.com` got through the proxy.

`appium server -ka 800 --use-plugins=appium-interceptor --plugin-appium-interceptor-whitelisteddomains='["*.mydomain.com"]' -pa /wd/hub`

Example of `blacklisteddomains`: all the call go through the proxy, except the one from `*.otherdomain.com`.

`appium server -ka 800 --use-plugins=appium-interceptor --plugin-appium-interceptor-blacklisteddomains='["*.otherdomain.com"]' -pa /wd/hub`

Note: `whitelisteddomains` and `blacklisteddomains` are two different approach and are not supposed to be used together. If both are present, `blacklisteddomains` will be ignored.

## what does this plugin do?

For every appium session, interceptor plugin will start a proxy server and updates the device proxy settings to pass all network traffic to proxy server. Mocking is disabled by default and can be enabled from the test by passing `appium:intercept : true` in the desired capability while creating a new appium session.

Please refer to the [commands](/docs/commands.md) sections for detailed usage.

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
