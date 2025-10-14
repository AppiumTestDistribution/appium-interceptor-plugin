import path from 'path';

export interface IPluginArgs {
  certdirectory: string;
}

export const DefaultPluginArgs: IPluginArgs = {
  certdirectory: path.join(__dirname, '..', 'certificate'),
};