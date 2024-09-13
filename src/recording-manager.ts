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
  private readonly simulationStrategyMap = new Map<string, ReplayStrategy>();
  
  constructor(private readonly options: ProxyOptions) {}

  public getCapturedTraffic(_sniffers: ApiSniffer[]): RequestInfo[] {
    const apiRequests: RequestInfo[] = [];
  
    _sniffers.forEach(sniffer => {
      const apiConfigMap = new Map<string, RequestInfo>();
      const requests = sniffer.getRequests();
  
      if (!requests || requests.length === 0) {
        log.info(`No requests found for sniffer: ${sniffer}`);
        return;
      }
  
      requests.forEach(request => {
        log.info(`Processing request for url: ${request.responseBody}`);
        const path = new URL(request.url).pathname;
        log.info(`Extracted path: ${path}`);
        const key = `${path}_${request.method}`;
        
        if (apiConfigMap.has(key)) {
          log.info(`Key already exists: ${key}, enqueuing response body: ${request.responseBody}`);
          const existingConfig = apiConfigMap.get(key)!;
          existingConfig.responseBody.push(request.responseBody);  // Using non-null assertion
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
          log.info(`Added new RecordConfig to apiConfigMap with key: ${key}`);
        }
      });
  
      apiRequests.push(...apiConfigMap.values());
    });
    return apiRequests;
  }  
  
  public startTrafficReplay(simulationConfig: ReplayConfig) {
    const recordConfigs = simulationConfig.recordings;
    this.simulationStrategyMap.set(this.options.sessionId, simulationConfig.replayStrategy ? 
                                    simulationConfig.replayStrategy : ReplayStrategy.DEFAULT);

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
        log.info(`setting records to map for url: ${recordConfig.url}`);
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
    log.info(`finding matching mock for url: ${url}`);
    log.info(`Does mock exists in map: ${this.records.has(id)} for id: ${id}`);

    if (this.records.has(id)) {
      const record = this.records.get(id);
      const recordConfig = record?.getConfig();
      if (recordConfig) {
        log.info(`Mock found for url: ${url.pathname}`)
        matchedRecords.push(recordConfig);
      }
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
      log.info(`returning requests from proxy server.. !!`);
    } else {
      log.info(`trying to return from backend in record`);
      // modifyResponseBody(ctx, recordConfig);
      next();
    }
  }
}