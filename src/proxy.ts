import { ApiMock } from './types';
import {
  Proxy as HttpProxy,
  IContext,
  IProxyOptions,
  OnRequestDataCallback,
  ErrorCallback,
} from 'http-mitm-proxy';
import { v4 as uuid } from 'uuid';
import http from 'http';
import {
  addDefaultMocks,
  compileApiMock,
  constructURLFromRequest,
  matchHttpMethod,
  matchUrl,
  updateRequestBody,
  updateRequestHeaders,
  updateRequestUrl,
} from './utils/proxy';
import BrMiddleware from './proxy-middlewares/br';

export type ProxyOptions = {
  deviceUDID: string;
  sessionId: string;
  certificatePath: string;
  port: number;
  ip: string;
};

const MOCK_BACKEND_HTML = `<html><head><title>Appium Mock</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center">
<h1>Hurray 🎉</h1>
<p style="font-size:24px">Your device is successfully connected to appium interceptor plugin</p>
<p style="font-size:24px">Download the certificate <a href="www.google.com">here</a></p>
</body></html>`;

export class Proxy {
  private started: boolean = false;
  private mocks: Map<string, ApiMock> = new Map();
  private httpProxy!: HttpProxy;

  constructor(private options: ProxyOptions) {
    this.httpProxy = new HttpProxy();
    addDefaultMocks(this);
  }

  public getPort() {
    return this.options.port;
  }

  public getIp() {
    return this.options.ip;
  }

  public getDeviceUDID() {
    return this.options.deviceUDID;
  }

  public getCertificatePath() {
    return this.options.certificatePath;
  }

  public addMock(apiMock: ApiMock) {
    const id = uuid();
    this.mocks.set(id, apiMock);
    return id;
  }

  public removeMock(id: string) {
    this.mocks.delete(id);
  }

  public isStarted() {
    return this.started;
  }

  public async start() {
    if (this.isStarted()) {
      return this.isStarted();
    }
    const proxyOptions: IProxyOptions = {
      port: this.options.port,
      sslCaDir: this.options.certificatePath,
      host: '::',
    };

    this.httpProxy.onRequest(this._onMockApiRequest.bind(this));

    await new Promise((resolve) => {
      this.httpProxy.listen(proxyOptions, () => {
        this.started = true;
        resolve(true);
      });
    });
  }

  public async stop() {
    this.httpProxy.close();
  }

  private async _onMockApiRequest(ctx: IContext, next: ErrorCallback) {
    const matchedMocks = await this.getMatchingMock(ctx);
    if (matchedMocks.length) {
      const compiledMock = compileApiMock(matchedMocks);
      this.performMock(ctx, compiledMock, next);
    } else {
      next();
    }
  }

  private async getMatchingMock(ctx: IContext) {
    let request: http.IncomingMessage = ctx.clientToProxyRequest;
    if (!request.headers?.host) {
      return [];
    }
    const url = constructURLFromRequest({
      host: request.headers.host!,
      path: request.url!,
      protocol: ctx.isSSL ? 'https://' : 'http://',
    }).toString();

    const matchedMocks = [];
    for (let [id, mock] of this.mocks.entries()) {
      if (matchUrl(mock.url, url) && matchHttpMethod(request, mock.method)) {
        matchedMocks.push(mock);
      }
    }

    return matchedMocks;
  }

  private performMock(ctx: IContext, apiMock: ApiMock, callback: ErrorCallback) {
    ctx.use(HttpProxy.gunzip);
    ctx.use(BrMiddleware);

    this._updateClientRequest(ctx, apiMock);
    this._updateClientResponse(ctx, apiMock, callback);
  }

  private _updateClientRequest(ctx: IContext, apiMock: ApiMock) {
    updateRequestUrl(ctx, apiMock);
    updateRequestHeaders(ctx, apiMock);
    updateRequestBody(ctx, apiMock);
  }

  private _updateClientResponse(ctx: IContext, apiMock: ApiMock, callback: ErrorCallback) {
    if (apiMock.statusCode && apiMock.responseBody) {
      ctx.proxyToClientResponse.writeHead(apiMock.statusCode);
      ctx.proxyToClientResponse.end(apiMock.responseBody);
      return;
    }

    const responseBodyChunks: Array<Buffer> = [];
    ctx.onResponseData((ctx: IContext, chunk: Buffer, callback: OnRequestDataCallback) => {
      responseBodyChunks.push(chunk);
      return callback(null, undefined);
    });
    ctx.onResponseEnd((ctx: IContext, callback: OnRequestDataCallback) => {
      console.log(Buffer.concat(responseBodyChunks).toString('utf8'));
      if (apiMock.statusCode) {
        ctx.proxyToClientResponse.writeHead(apiMock.statusCode);
      }
      if (apiMock.responseBody) {
        ctx.proxyToClientResponse.write(apiMock.responseBody);
      } else {
        ctx.proxyToClientResponse.write(Buffer.concat(responseBodyChunks).toString('utf8'));
      }
      callback(null);
    });

    callback();
  }
}
