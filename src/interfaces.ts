import path from 'path';

export interface IPluginArgs {
  certdirectory: string;
  whitelisteddomains: string[] | string;
  blacklisteddomains: string[] | string;
  upstreamproxy: string | null;
}

export const DefaultPluginArgs: IPluginArgs = {
  certdirectory: path.join(__dirname, '..', 'certificate'),
  whitelisteddomains: [],
  blacklisteddomains: [],
  upstreamproxy: null,
};