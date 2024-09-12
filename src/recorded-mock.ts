import { RecordConfig } from './types';

export class RecordedMock {
  private enabled = true;

  constructor(private id: string, private config: RecordConfig) {}

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

  updateConfig(config: RecordConfig) {
    this.config = config;
  }
}