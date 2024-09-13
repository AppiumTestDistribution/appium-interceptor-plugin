import { MockConfig, RecordConfig, RequestInfo, ReplayConfig, ReplayStrategy, SniffConfig } from './types';
import { Queue } from 'queue-typescript';
import { ProxyOptions } from './proxy';
import { RecordedMock } from './recorded-mock';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import { IContext } from 'http-mitm-proxy';
import { constructURLFromHttpRequest, modifyRequestBody, modifyRequestHeaders, modifyRequestUrl, modifyResponseBody, sleep } from './utils/record';
import { doesUrlMatch, parseJson } from './utils/proxy';
import { ApiSniffer } from './api-sniffer';
import log from './logger';


export class RecordingManager {
  private readonly records = new Map<string, RecordedMock>();
  private readonly sniffers = new Map<string, ApiSniffer>();
  private readonly simulationStrategyMap = new Map<string, ReplayStrategy>();
  
  constructor(private readonly options: ProxyOptions) {}

  public addRecordingSniffer(sniffConfig: SniffConfig): string {
    const id = uuid();
    const parsedConfig = !sniffConfig ? {} : parseJson(sniffConfig);
    this.sniffers.set(id, new ApiSniffer(id, parsedConfig));
    return id;
  }

  public getCapturedTraffic(id?: string): RecordConfig[] {
    const _sniffers = [...this.sniffers.values()];
    
    if (id && !_.isNil(this.sniffers.get(id))) {
      _sniffers.push(this.sniffers.get(id)!);
    }

    const apiRequests = _sniffers.reduce((acc, sniffer) => {
        const apiConfigMap = new Map<string, RecordConfig>();
        sniffer.getRequests().forEach(request => {
            const path = new URL(request.url).pathname;
            const key = `${path}_${request.method}`;
            if (apiConfigMap.has(key)) {
                apiConfigMap.get(key)!.responseBody?.enqueue(request.responseBody);
            } else {
                const recordConfig: RecordConfig = {
                    url: request.url,  // Assuming 'path' is equivalent to 'url'
                    method: request.method,
                    requestBody: request.requestBody,
                    statusCode: request.statusCode,
                    headers: request.requestHeaders,
                    responseHeaders: request.responseHeaders,
                    responseBody: new Queue<string>()  // Initialize the queue
                }
                recordConfig.responseBody?.enqueue(request.responseBody);
                apiConfigMap.set(key, recordConfig);
            }
        });
        acc.push(...apiConfigMap.values());
        return acc;
    }, [] as RecordConfig[]);
    _sniffers.forEach((sniffer) => this.sniffers.delete(sniffer.getId()));
    log.info(`Fetching api requests as: ${apiRequests}`);
    return apiRequests;
  }
  
  public startTrafficReplay(simulationConfig: ReplayConfig) {
    const recordConfigs = simulationConfig.recordings;
    this.simulationStrategyMap.set(this.options.sessionId, simulationConfig.replayStrategy ? 
                                    simulationConfig.replayStrategy : ReplayStrategy.DEFAULT);

    recordConfigs.forEach(recordConfig => {
        const responseBody : Queue<string> = new Queue<string>();
        const id = `${this.options.deviceUDID}_${recordConfig.url}_${recordConfig.method?.toLowerCase()}`;

        if (recordConfig.responseBody && recordConfig.responseBody.length > 0) {
          for (const response of recordConfig.responseBody) {
            responseBody.append(response);
          }
        }
        recordConfig.responseBody = responseBody;
        this.records.set(id, new RecordedMock(id, recordConfig));
    })
  }

  public async handleRecordingApiRequest(ctx: IContext, next: () => void): Promise<void> {
    const matchedRecords = await this.findMatchingRecords(ctx);
    if (matchedRecords.length) {
      matchedRecords.forEach(matchedRecord => {
        this.applyRecordToRequest(ctx, matchedRecord, next);
      })
    } else {
      next();
    }
  }

  private async findMatchingRecords(ctx: IContext): Promise<RecordConfig[]> {
    const request = ctx.clientToProxyRequest;
    if (!request.headers?.host || !request.url) {
      return [];
    }

    const url = constructURLFromHttpRequest({
      host: request.headers.host,
      path: request.url,
      protocol: ctx.isSSL ? 'https://' : 'http://',
    });

    const matchedRecords: RecordConfig[] = [];
    const id = `${this.options.deviceUDID}_${url.pathname}_${request.method?.toLowerCase()}`;

    if (this.records.has(id)) {
        const record = this.records.get(id);
        const recordConfig = record?.getConfig();
        if (recordConfig) matchedRecords.push(recordConfig);
    } else {
      for (const record of this.records.values()) {
        const recordConfig = record?.getConfig();
        if (doesUrlMatch(recordConfig.url, url.toString())) {
          matchedRecords.push(recordConfig);
          break;
        }
      }
    }

    return matchedRecords;
  }

  private async applyRecordToRequest(ctx: IContext, recordConfig: RecordConfig, next: () => void) {
    if (recordConfig.delay) {
      await sleep(recordConfig.delay);
    }
    this.modifyClientRequest(ctx, recordConfig);
    this.modifyClientResponse(ctx, recordConfig, next);
  }

  private modifyClientRequest(ctx: IContext, recordConfig: RecordConfig): void {
    modifyRequestUrl(ctx, recordConfig);
    modifyRequestHeaders(ctx, recordConfig);
    modifyRequestBody(ctx, recordConfig);
  }

  private async modifyClientResponse(ctx: IContext, recordConfig: RecordConfig, next: () => void) {
    const id = `${this.options.deviceUDID}_${recordConfig.url}_${recordConfig.method?.toLowerCase()}`;

    if (recordConfig.statusCode && recordConfig.responseBody && recordConfig.responseBody.length > 0) {
      ctx.proxyToClientResponse.writeHead(recordConfig.statusCode);
      const responseBody = recordConfig.responseBody.dequeue();
      
      this.simulationStrategyMap.get(this.options.sessionId) === ReplayStrategy.CIRCULAR ? recordConfig.responseBody.enqueue(responseBody) : null;
      ctx.proxyToClientResponse.end(responseBody);
      
      if (this.records.has(id) && recordConfig.responseBody.length <= 0) {
        this.records.delete(id);
      }
    } else {
      modifyResponseBody(ctx, recordConfig);
      next();
    }
  }
}