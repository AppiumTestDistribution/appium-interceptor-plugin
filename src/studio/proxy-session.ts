import { Proxy } from '../proxy';
import { Device } from '../types';

export class ProxySession {
  constructor(private _id: string, private _device: Device, private _proxy: Proxy) {}

  get id() {
    return this._id;
  }

  get device() {
    return this._device;
  }

  get proxy() {
    return this._proxy;
  }
}
