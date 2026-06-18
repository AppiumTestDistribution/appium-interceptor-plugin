import { expect } from 'chai';
import { Proxy } from '../src/proxy';
import { AppiumInterceptorPlugin } from '../src/plugin';
import proxyCache from '../src/proxy-cache';

describe('Unit Tests - removeAllMocks', () => {
  it('should successfully add and remove all mocks from Proxy', () => {
    const proxy = new Proxy({
      deviceUDID: 'test-udid',
      sessionId: 'test-session',
      certificatePath: 'test-cert-path',
      port: 12345,
      ip: '127.0.0.1',
    });

    expect(proxy.getMockCount()).to.equal(0);

    const mockId1 = proxy.addMock({ url: '/api/test1' });
    const mockId2 = proxy.addMock({ url: '/api/test2' });

    expect(proxy.getMockCount()).to.equal(2);

    proxy.removeAllMocks();

    expect(proxy.getMockCount()).to.equal(0);
  });

  it('should successfully call removeAllMocks from AppiumInterceptorPlugin command', async () => {
    const plugin = new AppiumInterceptorPlugin('interceptor', {});
    const proxy = new Proxy({
      deviceUDID: 'test-udid',
      sessionId: 'test-session',
      certificatePath: 'test-cert-path',
      port: 12345,
      ip: '127.0.0.1',
    });

    proxyCache.add('test-session', proxy);

    const driver = {
      sessionId: 'test-session',
    };

    await plugin.addMock(null, driver, { url: '/api/test1' });
    await plugin.addMock(null, driver, { url: '/api/test2' });

    expect(proxy.getMockCount()).to.equal(2);

    await plugin.removeAllMocks(null, driver);

    expect(proxy.getMockCount()).to.equal(0);

    proxyCache.remove('test-session');
  });
});
