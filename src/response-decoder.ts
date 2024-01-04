import zlib from 'zlib';
import type { IContext } from 'http-mitm-proxy';

//decoders to defalte compressed response body from actual server
const decoders: {
  [key: string]: any;
} = {
  br: zlib.createBrotliDecompress,
  gzip: zlib.createGunzip,
  deflate: zlib.createInflate,
};

export default {
  onResponse(ctx: IContext, callback: Function) {
    const serverToProxyResponse = ctx.serverToProxyResponse!;
    const encoding = serverToProxyResponse.headers['content-encoding']?.toLowerCase();
    if (encoding && decoders[encoding]) {
      delete serverToProxyResponse.headers['content-encoding'];
      ctx.addResponseFilter(decoders[encoding]());
    }
    return callback();
  },
  onRequest(ctx: IContext, callback: Function) {
    ctx.proxyToServerRequestOptions!.headers['accept-encoding'] = 'gzip';
    return callback();
  },
};
