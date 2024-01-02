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
import { updateRequestBody, updateRequestHeaders, updateRequestUrl } from './utils/proxy';

export type ProxyOptions = {
  deviceUDID: string;
  sessionId: string;
  certificatePath: string;
  port: number;
  ip: string;
};

export class Proxy {
  private started: boolean = false;
  private mocks: Map<string, ApiMock> = new Map();
  private httpProxy!: HttpProxy;

  constructor(private options: ProxyOptions) {
    this.httpProxy = new HttpProxy();
    this.mocks.set('123', {
      url: new RegExp(/api\/users/g),
      updateUrl: {
        pattern: new RegExp(/page=1/g),
        replaceWith: 'page=12',
      },
    });
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

  private async _onMockApiRequest(ctx: IContext, callback: ErrorCallback) {
    const mockId = await this.getMatchingMock(ctx.clientToProxyRequest);
    if (mockId) {
      this.performMock(ctx, mockId, callback);
    } else {
      callback();
    }
  }

  private async getMatchingMock(request: http.IncomingMessage) {
    //find the mock and return the id
    return '123';
  }

  private performMock(ctx: IContext, mockId: string, callback: ErrorCallback) {
    const apiMock = this.mocks.get(mockId);
    if (!apiMock) {
      return;
    }

    this._updateClientRequest(ctx, apiMock);
    this._updateClientResponse(ctx, apiMock, callback);
  }

  private _updateClientRequest(ctx: IContext, apiMock: ApiMock) {
    updateRequestUrl(ctx, apiMock);
    updateRequestHeaders(ctx, apiMock);
    updateRequestBody(ctx, apiMock);
  }

  private _updateClientResponse(ctx: IContext, apiMock: ApiMock, callback: ErrorCallback) {
    if (apiMock.statusCode) {
      ctx.proxyToClientResponse.writeHead(apiMock.statusCode);
    }

    if (apiMock.postBody) {
      const requestBodyChunks: Array<Buffer> = [];
      ctx.onRequestData((ctx: IContext, chunk: Buffer, callback: OnRequestDataCallback) => {
        requestBodyChunks.push(chunk);
        callback(null, undefined);
      });
      ctx.onRequestEnd((ctx: IContext, callback: OnRequestDataCallback) => {
        console.log(Buffer.concat(requestBodyChunks).toString('utf-8'));
        ctx.proxyToClientResponse.write(Buffer.concat(requestBodyChunks).toString('utf-8'));
        callback();
      });
    }

    callback();
  }
}
