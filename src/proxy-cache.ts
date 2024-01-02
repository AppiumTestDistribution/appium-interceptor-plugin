import { Proxy } from './proxy';

class ProxyCache {
  private cache: Map<string, Proxy> = new Map();

  add(sessionId: string, proxy: Proxy) {
    this.cache.set(sessionId, proxy);
  }

  remove(sessionId: string) {
    this.cache.delete(sessionId);
  }

  get(sessionId: string) {
    return this.cache.get(sessionId);
  }
}

export default new ProxyCache();
