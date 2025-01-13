import { Proxy } from 'http-mitm-proxy';

const proxy = new Proxy();
console.log('begin listening on 8081');
proxy.listen({
  port: 8081,
  sslCaDir: '/Users/sudharsanselvaraj/Documents/git/oss/appium-interceptor-plugin/certificate',
});
