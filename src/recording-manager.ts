import { MockConfig, RecordConfig, RequestInfo, ReplayConfig, ReplayStrategy, SniffConfig } from './types';
import { Queue } from 'queue-typescript';
import { ProxyOptions } from './proxy';
import { Record } from './record';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import { IContext } from 'http-mitm-proxy';
import { constructURLFromHttpRequest, modifyRequestBody, modifyRequestHeaders, modifyRequestUrl, modifyResponseBody, sleep } from './utils/record';
import { doesUrlMatch, parseJson } from './utils/proxy';
import { ApiSniffer } from './api-sniffer';
import log from './logger';


export class RecordingManager {
  private readonly records = new Map<string, Map<string, Record>>();
  private readonly simulationStrategyMap = new Map<string, ReplayStrategy>();
  
  constructor(private readonly options: ProxyOptions) {}

  public getCapturedTraffic(_sniffers: ApiSniffer[]): RequestInfo[] {
    const apiRequests: RequestInfo[] = [];
  
    _sniffers.forEach(sniffer => {
      const apiConfigMap = new Map<string, RequestInfo>();
      const requests = sniffer.getRequests();
  
      if (!requests || requests.length === 0) {
        return;
      }
  
      requests.forEach(request => {
        const path = new URL(request.url).pathname;
        const key = `${path}_${request.method}`;
        
        if (apiConfigMap.has(key)) {
          const existingConfig = apiConfigMap.get(key)!;
          existingConfig.responseBody.push(request.responseBody);  
        } else {
          const recordConfig: RequestInfo = {
            url: request.url,
            method: request.method,
            requestBody: request.requestBody,
            statusCode: request.statusCode,
            requestHeaders: request.requestHeaders,
            responseHeaders: request.responseHeaders,
            responseBody: [request.responseBody]
          };
          apiConfigMap.set(key, recordConfig);
        }
      });
  
      apiRequests.push(...apiConfigMap.values());
    });
    return apiRequests;
  }  
  
  public replayTraffic(simulationConfig: ReplayConfig) {
    const recordConfigs = simulationConfig.recordings;
    this.simulationStrategyMap.set(this.options.sessionId, simulationConfig.replayStrategy ? 
                                    simulationConfig.replayStrategy : ReplayStrategy.DEFAULT);
    
    const recordMap = new Map<string, Record>();  
    const replayId = `${this.options.deviceUDID}-${this.options.sessionId}`;

    recordConfigs.forEach(recordConfig => {
        const responseBody : Queue<string> = new Queue<string>();
        const url = new URL(recordConfig.url);
        const id = `${this.options.deviceUDID}_${url.pathname}_${recordConfig.method?.toLowerCase()}`;

        if (recordConfig.responseBody && recordConfig.responseBody.length > 0) {
          for (const response of recordConfig.responseBody) {
            responseBody.append(response);
          }
        }
        recordConfig.responseBody = responseBody;
        recordMap.set(id, new Record(id, recordConfig));
    })
    this.records.set(replayId, recordMap);
    return replayId;
  }

  public stopReplay(id?: string): void {
    const replayId = id ?? `${this.options.deviceUDID}-${this.options.sessionId}`;
    this.records.delete(replayId);
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

  public async findMatchingRecords(ctx: IContext): Promise<RecordConfig[]> {
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
    const records = this.records.get(`${this.options.deviceUDID}-${this.options.sessionId}`);

    if (records && records.has(id)) {
      const record = records.get(id);
      const recordConfig = record?.getConfig();
      if (recordConfig) {
        matchedRecords.push(recordConfig);
      }
    } else if (records) {
      for (const record of records.values()) {
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