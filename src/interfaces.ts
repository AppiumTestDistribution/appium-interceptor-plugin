import path from 'path';

export interface IPluginArgs {
  certdirectory: string;
  whitelisteddomains: string[] | string;
  blacklisteddomains: string[] | string;
}

export const DefaultPluginArgs: IPluginArgs = {
  certdirectory: path.join(__dirname, '..', 'certificate'),
  whitelisteddomains: [],
  blacklisteddomains: [],
};