import { MockConfig, RecordConfig, RequestInfo, SimulationConfig, SimulationStrategy, SniffConfig } from './types';
import { Queue } from 'queue-typescript';
import { ProxyOptions } from './proxy';
import { RecordedMock } from './recorded-mock';
import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import { IContext } from 'http-mitm-proxy';
import { constructURLFromHttpRequest, modifyRequestBody, modifyRequestHeaders, modifyRequestUrl, modifyResponseBody, sleep } from './utils/record';
import { doesUrlMatch, parseJson } from './utils/proxy';
import { ApiSniffer } from './api-sniffer';


export class RecordingManager {
  private readonly records = new Map<string, RecordedMock>();
  private readonly sniffers = new Map<string, ApiSniffer>();
  private readonly simulationStrategyMap = new Map<string, SimulationStrategy>();
  
  constructor(private readonly options: ProxyOptions) {}

  public addRecordingSniffer(sniffConfig: SniffConfig): string {
    const id = uuid();
    const parsedConfig = !sniffConfig ? {} : parseJson(sniffConfig);
    this.sniffers.set(id, new ApiSniffer(id, parsedConfig));
    return id;
  }

  public getCapturedTraffic(id?: string): RequestInfo[] {
    const _sniffers = [...this.sniffers.values()];
    if (id && !_.isNil(this.sniffers.get(id))) {
      _sniffers.push(this.sniffers.get(id)!);
    }
    const requestInfoMap = new Map<string, RequestInfo>();
    _sniffers.forEach(sniffer => {
      sniffer.getRequests().forEach(request => {
        const key = `${request.url}_${request.method}`;
        if (!requestInfoMap.has(key)) {
          const requestInfo: RequestInfo = {
            url: request.url,
            method: request.method,
            requestBody: request.requestBody,
            statusCode: request.statusCode,
            requestHeaders: request.requestHeaders,
            responseBody: [request.responseBody], 
            responseHeaders: request.responseHeaders
          };
          requestInfoMap.set(key, requestInfo);
        } else {
          (requestInfoMap.get(key)!.responseBody as any[]).push(request.responseBody);
        }
      });
    });
    return Array.from(requestInfoMap.values());
  }
  
  public startSimulation(simulationConfig: SimulationConfig) {
    const recordConfigs = simulationConfig.recordings;
    this.simulationStrategyMap.set(this.options.sessionId, simulationConfig.simulationStrategy ? 
                                    simulationConfig.simulationStrategy : SimulationStrategy.DEFAULT);

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
      const responseBody = recordConfig.responseBody.dequeue();;
      
      this.simulationStrategyMap.get(this.options.sessionId) === SimulationStrategy.RECYCLE ? recordConfig.responseBody.enqueue(responseBody) : null;
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