# appium-interceptor-plugin

This is an Appium plugin designed to intercept API response and mocking easy.
This plugin uses mitmproxy

## Prerequisite

1. Appium version 2.0
2. Intercepting API requests from android requires CA certificate to be installed on the device. Follow the instructions in [How to install CA certificate on android](./docs/certificate-installation.md) section and install the CA certificate.

## Installation - Server

Install the plugin using Appium's plugin CLI, either as a named plugin or via NPM:

```shell
appium plugin install --source=npm appium-interceptor-plugin
```

## Activation

The plugin will not be active unless turned on when invoking the Appium server:

`appium server -ka 800 --use-plugins=appium-interceptor -pa /wd/hub`

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

## Build local

`npm install`

`npm run build`
