import zlib from 'zlib';
import type { IContext } from 'http-mitm-proxy';

export default {
  onResponse(ctx: IContext, callback: Function) {
    const serverToProxyResponse = ctx.serverToProxyResponse!;
    if (serverToProxyResponse.headers['content-encoding']?.toLowerCase() == 'br') {
      delete serverToProxyResponse.headers['content-encoding'];
      ctx.addResponseFilter(zlib.createBrotliDecompress());
    }
    return callback();
  },
  onRequest(ctx: IContext, callback: Function) {
    return callback();
  },
};
