import { BasePlugin } from 'appium/plugin';
import http from "http";
import {Application} from "express"
import { CliArg, ISessionCapability } from './types';

export class AppiumInterceptorPlugin extends BasePlugin {
  constructor(name: string, cliArgs: CliArg) {
    super(name, cliArgs);
  }

  static async updateServer(expressApp:Application , httpServer: http.Server, cliArgs:CliArg) {
    
  }

  async createSession(
    next: () => any,
    driver: any,
    jwpDesCaps: any,
    jwpReqCaps: any,
    caps: ISessionCapability,
  ){
    const response = await next();
    return response;

    //const shouldIntercept = _.merge(caps.alwaysMatch, caps.firstMatch[0] || {})["appium:intercept"]
    //const deviceUDID = response.value[1].deviceUDID
    //const adb = driver.sessions[response.value[0]].adb
  
  }

}