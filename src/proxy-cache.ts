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

  getAllSessionIds(): string[] {
    return Array.from(this.cache.keys());
  }

  clear() {
    this.cache.clear();
  }
}

export default new ProxyCache();
