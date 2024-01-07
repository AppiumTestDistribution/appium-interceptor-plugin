import { MockConfig } from './types';
import { Proxy as HttpProxy, IContext, IProxyOptions } from 'http-mitm-proxy';
import { v4 as uuid } from 'uuid';
import {
  addDefaultMocks,
  compileMockConfig,
  constructURLFromHttpRequest,
  doesHttpMethodMatch,
  doesUrlMatch,
  modifyRequestBody,
  modifyRequestHeaders,
  modifyRequestUrl,
  modifyResponseBody,
} from './utils/proxy';
import ResponseDecoder from './response-decoder';
import { Mock } from './mock';

export interface ProxyOptions {
  deviceUDID: string;
  sessionId: string;
  certificatePath: string;
  port: number;
  ip: string;
}

export class Proxy {
  private _started = false;
  private readonly mocks = new Map<string, Mock>();
  private readonly httpProxy: HttpProxy;

  public isStarted(): boolean {
    return this._started;
  }

  constructor(private readonly options: ProxyOptions) {
    this.httpProxy = new HttpProxy();
    addDefaultMocks(this);
  }

  public get port(): number {
    return this.options.port;
  }

  public get ip(): string {
    return this.options.ip;
  }

  public get deviceUDID(): string {
    return this.options.deviceUDID;
  }

  public get certificatePath(): string {
    return this.options.certificatePath;
  }

  public async start(): Promise<boolean> {
    if (this._started) return true;

    const proxyOptions: IProxyOptions = {
      port: this.port,
      sslCaDir: this.certificatePath,
      host: '::', // IPv6 any
      forceSNI: true,
    };

    this.httpProxy.onRequest(this.handleMockApiRequest.bind(this));

    await new Promise((resolve) => {
      this.httpProxy.listen(proxyOptions, () => {
        this._started = true;
        resolve(true);
      });
    });

    return true;
  }

  public async stop(): Promise<void> {
    this.httpProxy.close();
  }

  public addMock(mockConfig: MockConfig): string {
    const id = uuid();
    this.mocks.set(id, new Mock(id, mockConfig));
    return id;
  }

  public removeMock(id: string): void {
    this.mocks.delete(id);
  }

  private async handleMockApiRequest(ctx: IContext, next: () => void): Promise<void> {
    const matchedMocks = await this.findMatchingMocks(ctx);
    if (matchedMocks.length) {
      const compiledMock = compileMockConfig(matchedMocks);
      this.performMockResponse(ctx, compiledMock, next);
    } else {
      next();
    }
  }

  private async findMatchingMocks(ctx: IContext): Promise<MockConfig[]> {
    const request = ctx.clientToProxyRequest;
    if (!request.headers?.host || !request.url) {
      return [];
    }

    const url = constructURLFromHttpRequest({
      host: request.headers.host,
      path: request.url,
      protocol: ctx.isSSL ? 'https://' : 'http://',
    }).toString();

    const matchedMocks: MockConfig[] = [];
    for (const mock of this.mocks.values()) {
      const config = mock.getConfig();
      if (doesUrlMatch(config.url, url) && doesHttpMethodMatch(request, config.method)) {
        matchedMocks.push(config);
      }
    }

    return matchedMocks;
  }

  private performMockResponse(ctx: IContext, mockConfig: MockConfig, next: () => void): void {
    ctx.use(ResponseDecoder);

    this.modifyClientRequest(ctx, mockConfig);
    this.modifyClientResponse(ctx, mockConfig, next);
  }

  private modifyClientRequest(ctx: IContext, mockConfig: MockConfig): void {
    modifyRequestUrl(ctx, mockConfig);
    modifyRequestHeaders(ctx, mockConfig);
    modifyRequestBody(ctx, mockConfig);
  }

  private modifyClientResponse(ctx: IContext, mockConfig: MockConfig, next: () => void): void {
    if (mockConfig.statusCode && mockConfig.responseBody) {
      ctx.proxyToClientResponse.writeHead(mockConfig.statusCode);
      ctx.proxyToClientResponse.end(mockConfig.responseBody);
    } else {
      modifyResponseBody(ctx, mockConfig);
      next();
    }
  }
}
