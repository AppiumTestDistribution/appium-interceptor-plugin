import { MockConfig } from './types';

export class Mock {
  private enabled = true;

  constructor(private id: string, private config: MockConfig) {}

  getId() {
    return this.id;
  }

  getConfig() {
    return this.config;
  }

  isEnabled() {
    return this.enabled;
  }

  setEnableStatus(enbaleStatus: boolean) {
    this.enabled = enbaleStatus;
  }

  updateConfig(config: MockConfig) {
    this.config = config;
  }
}
