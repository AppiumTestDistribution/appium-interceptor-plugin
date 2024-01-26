import { Client as AdbClient } from '@devicefarmer/adbkit';
import _ from 'lodash';
import { Device } from '../types';

export class DeviceRegisrty {
  private devices: Array<Device> = [];

  constructor(private adb: AdbClient) {}

  async start() {
    const existingDevices = await this.adb.listDevices();
    existingDevices.map(this.addNewDevice.bind(this));

    try {
      const tracker = await this.adb.trackDevices();
      tracker.on('add', this.addNewDevice.bind(this));
      tracker.on(
        'remove',
        (device) => (this.devices = _.remove(this.devices, (id) => id == device.id))
      );
      tracker.on('error', (err) => console.log(err));
    } catch (err) {
      console.log('Error tracking andorid device');
    }
  }

  private async addNewDevice(device: { id: string }) {
    const deviceClient = this.adb.getDevice(device.id);
    await deviceClient.waitForDevice();
    await deviceClient.waitBootComplete();
    const properties = await deviceClient.getProperties();
    this.devices.push({
      udid: device.id,
      isReal: properties['ro.build.characteristics'] !== 'emulator',
    });
  }

  getDevices() {
    return this.devices;
  }

  getDevice(udid: string) {
    return this.devices.find((d) => d.udid == udid);
  }
}
