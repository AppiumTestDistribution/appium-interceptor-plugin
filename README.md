# appium-interceptor-plugin

This is an Appium plugin designed to intercept API response and mocking easy. 
This plugin uses mitmproxy

## Prerequisite

Appium version 2.0

## Installation - Server

Install the plugin using Appium's plugin CLI, either as a named plugin or via NPM:

```shell
appium plugin install --source=npm appium-interceptor-plugin
```

## Activation

The plugin will not be active unless turned on when invoking the Appium server:

`appium server -ka 800 --use-plugins=appium-interceptor -pa /wd/hub`

## Supported Platforms

💚 `Android`

### what does this plugin do? 

Plugin will set proxy to the device and intercept the API response and mock the response based on the request.

**Mocking support** 

1. Mocking response based on the request
2. Mocking response based on the request and response
3. Mocking response based on the request and response and request body
4. Mocking request headers
5. Mocking partial response from server

### Usage
Refer Examples [here](./test/plugin-test.js)
## Build local
`npm install`

`npm run build`


