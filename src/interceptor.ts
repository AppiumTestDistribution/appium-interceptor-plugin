import { ErrorCallback, IContext } from 'http-mitm-proxy';
import stream from 'stream';
import { constructURLFromHttpRequest } from './utils/proxy';
import responseDecoder from './response-decoder';
import parseHeader from 'parse-headers';

function readBodyFromStream(writable: stream.Writable | undefined, callback: (value: any) => void) {
  if (!writable) {
    return callback(null);
  }
  const [originalWrite, originalEnd] = [writable.write, writable.end];
  const chunks: Buffer[] = [];

  (writable.write as unknown) = function (...args: any) {
    chunks.push(typeof args[0] === 'string' ? Buffer.from(args[0]) : args[0]);
    originalWrite.apply(writable, args);
  };

  (writable.end as unknown) = async function (...args: any) {
    if (args[0]) {
      chunks.push(typeof args[0] === 'string' ? Buffer.from(args[0]) : args[0]);
    }
    originalEnd.apply(writable, args);
    callback(Buffer.concat(chunks).toString('utf8'));
  };
}

function RequestInterceptor(requestCompletionCallback: (value: any) => void) {
  return function (ctx: IContext, callback: ErrorCallback) {
    ctx.use(responseDecoder);
    const requestData = {} as any;
    const requestBodyDataChunks: Buffer[] = [];

    // Get request body from http-mitm-proxy
    // more info: https://github.com/joeferner/node-http-mitm-proxy/blob/master/README.md#proxyonrequestendfn-or-ctxonrequestendfn
    ctx.onRequestData(function (ctx, chunk, callback) {
      requestBodyDataChunks.push(chunk);
      return callback(null, chunk);
    });

    ctx.onRequestEnd((ctx, callback) => {
      readBodyFromStream(ctx.proxyToServerRequest, (requestBody) => {
        const requestBodyString = Buffer.concat(requestBodyDataChunks).toString('utf8');
        requestData['requestBody'] = requestBody ? requestBody : requestBodyString;
        requestData['requestHeaders'] = ctx.proxyToServerRequest?.getHeaders();
      });
      callback();
    });

    readBodyFromStream(ctx.proxyToClientResponse, (response) => {
      const { headers, url } = ctx.clientToProxyRequest;
      const protocol = ctx.isSSL ? 'https://' : 'http://';
      const _url = constructURLFromHttpRequest({
        host: headers.host!,
        path: url!,
        protocol,
      });
      const responseHeaders = parseHeader((ctx.proxyToClientResponse as any)?._header || '');
      requestData['url'] = _url.toString();
      requestData['method'] = ctx.clientToProxyRequest.method;
      requestData['responseBody'] = response;
      requestData['responseHeaders'] = responseHeaders;
      requestData['statusCode'] = ctx.proxyToClientResponse.statusCode;

      requestCompletionCallback(requestData);
    });
    callback();
  };
}

export { RequestInterceptor };
