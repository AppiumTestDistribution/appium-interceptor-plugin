import { Proxy } from './proxy';

class ProxyCache {
  private sessionMap: Map<string, Proxy> = new Map();
  private deviceMap: Map<string, Proxy> = new Map();

  add(sessionId: string, proxy: Proxy) {
    this.sessionMap.set(sessionId, proxy);
    if (proxy.deviceUDID) {
      this.deviceMap.set(proxy.deviceUDID, proxy);
    }
  }

  remove(sessionId: string) {
    const proxy = this.sessionMap.get(sessionId);
    this.sessionMap.delete(sessionId);
    if (proxy?.deviceUDID && this.deviceMap.get(proxy.deviceUDID) === proxy) {
      this.deviceMap.delete(proxy.deviceUDID);
    }
  }

  get(sessionId: string) {
    return this.sessionMap.get(sessionId);
  }

  getByDeviceId(deviceUDID: string): Proxy | undefined {
    return this.deviceMap.get(deviceUDID);
  }

  rebindSession(proxy: Proxy, newSessionId: string) {
    for (const [sId, p] of this.sessionMap.entries()) {
      if (p === proxy) {
        this.sessionMap.delete(sId);
      }
    }
    this.sessionMap.set(newSessionId, proxy);
    if (proxy.deviceUDID) {
      this.deviceMap.set(proxy.deviceUDID, proxy);
    }
  }

  getAllSessionIds(): string[] {
    return Array.from(this.sessionMap.keys());
  }

  clear() {
    this.sessionMap.clear();
    this.deviceMap.clear();
  }
}

export default new ProxyCache();
