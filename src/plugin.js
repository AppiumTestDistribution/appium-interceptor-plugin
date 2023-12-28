import { BasePlugin } from 'appium/plugin';
import B from 'bluebird';

export default class TemplatePlugin extends BasePlugin {
  constructor(name, cliArgs) {
    super(name, cliArgs);
  }

  static async updateServer(expressApp, httpServer, cliArgs) {
    expressApp.all("/cliArgs", (req, res) => {
      res.send(JSON.stringify(cliArgs));
    });
  }
}