import { MockConfig } from './types';
import { Proxy as HttpProxy, IContext, IProxyOptions, ErrorCallback } from 'http-mitm-proxy';
import { v4 as uuid } from 'uuid';
import http from 'http';
import {
  addDefaultMocks,
  compileMockConfig,
  constructURLFromRequest,
  matchHttpMethod,
  matchUrl,
  updateRequestBody,
  updateRequestHeaders,
  updateRequestUrl,
  updateResponseBody,
} from './utils/proxy';
import ResponseDecoder from './response-decoder';
import { Mock } from './mock';

export type ProxyOptions = {
  deviceUDID: string;
  sessionId: string;
  certificatePath: string;
  port: number;
  ip: string;
};

export class Proxy {
  private started: boolean = false;
  private mocks: Map<string, Mock> = new Map();
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

  public addMock(mockConfig: MockConfig) {
    const id = uuid();
    this.mocks.set(id, new Mock(id, mockConfig));
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
      this.httpProxy.listen({ ...proxyOptions, forceSNI: true }, () => {
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
      const compiledMock = compileMockConfig(matchedMocks);
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
      const config = mock.getConfig();
      if (matchUrl(config.url, url) && matchHttpMethod(request, config.method)) {
        matchedMocks.push(config);
      }
    }

    return matchedMocks;
  }

  private performMock(ctx: IContext, mockConfig: MockConfig, callback: ErrorCallback) {
    ctx.use(ResponseDecoder);

    this._updateClientRequest(ctx, mockConfig);
    this._updateClientResponse(ctx, mockConfig, callback);
  }

  private _updateClientRequest(ctx: IContext, mockConfig: MockConfig) {
    updateRequestUrl(ctx, mockConfig);
    updateRequestHeaders(ctx, mockConfig);
    updateRequestBody(ctx, mockConfig);
  }

  private _updateClientResponse(ctx: IContext, mockConfig: MockConfig, next: ErrorCallback) {
    if (mockConfig.statusCode && mockConfig.responseBody) {
      ctx.proxyToClientResponse.writeHead(mockConfig.statusCode);
      ctx.proxyToClientResponse.end(mockConfig.responseBody);
      return;
    }

    updateResponseBody(ctx, mockConfig);
    next();
  }
}
