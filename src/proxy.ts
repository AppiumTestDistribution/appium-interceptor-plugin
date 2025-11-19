import { MockConfig, RecordConfig, RequestInfo, SniffConfig } from './types';
import { Proxy as HttpProxy, IContext, IProxyOptions } from 'http-mitm-proxy';
import * as net from 'net';
import { ProxyAgent } from 'proxy-agent';
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
  parseJson,
  sleep,
} from './utils/proxy';
import ResponseDecoder from './response-decoder';
import { Mock } from './mock';
import { RequestInterceptor } from './interceptor';
import { ApiSniffer } from './api-sniffer';
import _ from 'lodash';
import log from './logger';
import { RecordingManager } from './recording-manager';

export interface ProxyOptions {
  deviceUDID: string;
  sessionId: string;
  certificatePath: string;
  port: number;
  ip: string;
  previousGlobalProxy?: ProxyOptions;
  whitelistedDomains?: string[];
  blacklistedDomains?: string[];
}

export class Proxy {
  private _started = false;
  private _replayStarted = false;
  private readonly mocks = new Map<string, Mock>();
  private readonly sniffers = new Map<string, ApiSniffer>();

  private readonly httpProxy: HttpProxy;
  private readonly recordingManager: RecordingManager;
  private proxyChainLocalUrl?: string;
  private closeProxyChain?: (url: string, closeConnections?: boolean) => Promise<void>;
  private upstreamAgent?: any;

  public isStarted(): boolean {
    return this._started;
  }

  public isReplayStarted(): boolean {
    return this._replayStarted;
  }

  public startReplaying(): void {
    this._replayStarted = true;
  }

  constructor(public readonly options: ProxyOptions) {
    this.httpProxy = new HttpProxy();
    this.recordingManager = new RecordingManager(options);
    addDefaultMocks(this);
  }

  public getRecordingManager(): RecordingManager {
    return this.recordingManager;
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

  public get previousGlobalProxy(): ProxyOptions | undefined {
    return this.options.previousGlobalProxy ?? undefined
  }

  public async start(): Promise<boolean> {
    if (this._started) return true;

    const proxyOptions: IProxyOptions = {
      port: this.port,
      sslCaDir: this.certificatePath,
      host: '::', // IPv6 any
      forceSNI: true,
    };

    await this.setupProxyChainUpstream();
    if (this.upstreamAgent) {
      proxyOptions.httpAgent = this.upstreamAgent;
      proxyOptions.httpsAgent = this.upstreamAgent;
      log.info('Routing traffic via proxy-chain upstream agent');
    }

    this.httpProxy.onConnect((req, clientToProxySocket, head, callback) => {
      const [hostname, port] = req.url!.split(':');
      const whitelistedDomains = this.options.whitelistedDomains ?? [];
      const blacklistedDomains = this.options.blacklistedDomains ?? [];

      let shouldIntercept = true;
      if (whitelistedDomains.length > 0) {
        shouldIntercept = whitelistedDomains.some((domain) => doesUrlMatch(domain, hostname));
      } else if (blacklistedDomains.length > 0) {
        shouldIntercept = !blacklistedDomains.some((domain) => doesUrlMatch(domain, hostname));
      }
      if (shouldIntercept) {
        return callback();
      } else {
        clientToProxySocket.on('error', (err) => {
          log.error(`Client socket error for ${hostname}: ${err.message}`);
        });

        const proxyToServerSocket = net.connect(
          {
            host: hostname,
            port: Number(port || 80),
          },
          () => {
            clientToProxySocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            if (head && head.length > 0) {
              proxyToServerSocket.write(head);
            }
            proxyToServerSocket.pipe(clientToProxySocket);
            clientToProxySocket.pipe(proxyToServerSocket);
          }
        );

        proxyToServerSocket.on('close', () => {
          clientToProxySocket.end();
        });

        clientToProxySocket.on('close', () => {
          proxyToServerSocket.end();
        });

        proxyToServerSocket.on('error', (err) => {
          log.error(`[Tunnel] Server socket error for ${hostname}: ${err.message}`);
          clientToProxySocket.end();
        });

        return;
      }
    });

    this.httpProxy.onRequest(
      RequestInterceptor((requestData: any) => {
        for (const sniffer of this.sniffers.values()) {
          sniffer.onApiRequest(requestData);
        }
      })
    );
    this.httpProxy.onRequest(this.handleMockApiRequest.bind(this));

    this.httpProxy.onError((context, error, errorType) => {
      log.error(`${errorType}: ${error}`);
    });

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
    if (this.proxyChainLocalUrl && this.closeProxyChain) {
      try {
        await this.closeProxyChain(this.proxyChainLocalUrl, true);
        log.info('proxy-chain anonymized proxy closed');
      } catch (e) {
        log.warn(`Failed to close proxy-chain anonymized proxy: ${String(e)}`);
      }
    }
  }

  public addMock(mockConfig: MockConfig): string {
    const id = uuid();
    this.mocks.set(id, new Mock(id, mockConfig));
    return id;
  }

  public removeMock(id: string): void {
    this.mocks.delete(id);
  }

  public enableMock(id: string): void {
    this.mocks.get(id)?.setEnableStatus(true);
  }

  public disableMock(id: string): void {
    this.mocks.get(id)?.setEnableStatus(false);
  }

  public addSniffer(sniffConfig: SniffConfig): string {
    const id = uuid();
    const parsedConfig = !sniffConfig ? {} : parseJson(sniffConfig);
    this.sniffers.set(id, new ApiSniffer(id, parsedConfig));
    return id;
  }

  public getInterceptedData(record: boolean, id?: string): RequestInfo[] {
    let sniffersToProcess;
    if (id && !_.isNil(this.sniffers.get(id))) {
      sniffersToProcess = [this.sniffers.get(id)!];
    } else {
      sniffersToProcess = [...this.sniffers.values()];
    }
    let apiRequests;
    if (record) {
      apiRequests = this.recordingManager.getCapturedTraffic(sniffersToProcess);
    } else {
      apiRequests = sniffersToProcess.reduce((acc, sniffer) => {
        acc.push(...sniffer.getRequests());
        return acc;
      }, [] as RequestInfo[]);
    }
    return apiRequests;
  }

  public removeSniffer(record: boolean, id?: string): RequestInfo[] {
    let sniffersToProcess;
    if (id && !_.isNil(this.sniffers.get(id))) {
      sniffersToProcess = [this.sniffers.get(id)!];
    } else {
      sniffersToProcess = [...this.sniffers.values()];
    }
    let apiRequests;
    if (record) {
      apiRequests = this.recordingManager.getCapturedTraffic(sniffersToProcess);
    } else {
      apiRequests = sniffersToProcess.reduce((acc, sniffer) => {
        acc.push(...sniffer.getRequests());
        return acc;
      }, [] as RequestInfo[]);
    }
    sniffersToProcess.forEach((sniffer) => this.sniffers.delete(sniffer.getId()));
    return apiRequests;
  }

  private async handleMockApiRequest(ctx: IContext, next: () => void): Promise<void> {
    if (this.isReplayStarted()) {
      this.recordingManager.handleRecordingApiRequest(ctx, next);
    } else if (!this.isReplayStarted()) {
      const matchedMocks = await this.findMatchingMocks(ctx);
      if (matchedMocks.length) {
        const compiledMock = compileMockConfig(matchedMocks);
        this.applyMockToRequest(ctx, compiledMock, next);
      }
      else {
        next();
      }
    }
  }

  private async setupProxyChainUpstream(): Promise<void> {
    const upstreamEnv = process.env.UPSTREAM_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (!upstreamEnv) return;
    try {
      const proxyChain = require('proxy-chain');
      if (!proxyChain || !proxyChain.anonymizeProxy) {
        log.warn('proxy-chain not available; skipping upstream setup');
        return;
      }
      const localUrl: string = await proxyChain.anonymizeProxy(upstreamEnv);
      this.proxyChainLocalUrl = localUrl;
      this.closeProxyChain = proxyChain.closeAnonymizedProxy;
      this.upstreamAgent = new ProxyAgent({ getProxyForUrl: () => localUrl });
      log.info(`proxy-chain upstream initialized at ${localUrl}`);
    } catch (e) {
      log.error(`Failed to initialize proxy-chain upstream: ${String(e)}`);
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
      if (
        mock.isEnabled() &&
        doesUrlMatch(config.url, url) &&
        doesHttpMethodMatch(request, config.method)
      ) {
        matchedMocks.push(config);
      }
    }

    return matchedMocks;
  }

  private async applyMockToRequest(ctx: IContext, mockConfig: MockConfig, next: () => void) {
    ctx.use(ResponseDecoder);
    if (mockConfig.delay) {
      await sleep(mockConfig.delay);
    }
    this.modifyClientRequest(ctx, mockConfig);
    this.modifyClientResponse(ctx, mockConfig, next);
  }

  private modifyClientRequest(ctx: IContext, mockConfig: MockConfig): void {
    modifyRequestUrl(ctx, mockConfig);
    modifyRequestHeaders(ctx, mockConfig);
    modifyRequestBody(ctx, mockConfig);
  }

  private async modifyClientResponse(ctx: IContext, mockConfig: MockConfig, next: () => void) {
    if (mockConfig.statusCode && mockConfig.responseBody) {
      ctx.proxyToClientResponse.writeHead(mockConfig.statusCode);
      ctx.proxyToClientResponse.end(mockConfig.responseBody);
    } else {
      try{
        modifyResponseBody(ctx, mockConfig);
      }catch (error) {
        log.error(`Error modifying response body: ${error}`);
        next();
      }
      next();
    }
  }
}
