import { IContext, OnRequestDataCallback } from 'http-mitm-proxy';
import {
  RecordConfig,
} from '../types';
import _ from 'lodash';
import log from '../logger';
import { parseRegex, processBody } from './proxy';

export function constructURLFromHttpRequest(request: {
  protocol: string;
  path: string;
  host: string;
}) {
  const urlString = `${request.protocol}${request?.host}${request.path}`;
  return new URL(urlString);
}

export function modifyRequestUrl(ctx: IContext, recordConfig: RecordConfig) {
  if (!recordConfig.updateUrl || !ctx.clientToProxyRequest || !ctx.proxyToServerRequestOptions) {
    return;
  }

  const { headers, url } = ctx.clientToProxyRequest;
  const protocol = ctx.isSSL ? 'https://' : 'http://';
  const originalUrl = constructURLFromHttpRequest({
    host: headers.host!,
    path: url!,
    protocol,
  });

  const updateUrlMatchers = _.castArray(recordConfig.updateUrl);
  const updatedUrlString = updateUrlMatchers.reduce((current, matcher) => {
    return current.replace(parseRegex(matcher.regexp as string), matcher.value);
  }, originalUrl.toString());

  const updatedUrl = new URL(updatedUrlString);
  ctx.proxyToServerRequestOptions.host = updatedUrl.hostname;
  ctx.proxyToServerRequestOptions.path = `${updatedUrl.pathname}${updatedUrl.search}`;
  ctx.proxyToServerRequestOptions.port = updatedUrl.port || ctx.proxyToServerRequestOptions.port;
  ctx.proxyToServerRequestOptions.headers.host= updatedUrl.hostname;
}

export function modifyRequestHeaders(ctx: IContext, recordConfig: RecordConfig) {
  if (!recordConfig.headers || !ctx.proxyToServerRequestOptions) {
    return;
  }

  const { headers } = ctx.proxyToServerRequestOptions;
  if (recordConfig.headers?.add) {
    Object.assign(headers, recordConfig.headers.add);
  }
  if (recordConfig.headers?.remove && Array.isArray(recordConfig.headers?.remove)) {
    recordConfig.headers.remove.forEach((header: string) => delete headers[header]);
  }
}

export function modifyRequestBody(ctx: IContext, recordConfig: RecordConfig) {
  const requestBodyChunks: Buffer[] = [];
  ctx.onRequestData((ctx: IContext, chunk: Buffer, callback: OnRequestDataCallback) => {
    requestBodyChunks.push(chunk);
    callback(null, undefined);
  });
  ctx.onRequestEnd((ctx: IContext, callback: OnRequestDataCallback) => {
    const originalBody = Buffer.concat(requestBodyChunks).toString('utf-8');
    let postBody = recordConfig.requestBody || originalBody;
    if (recordConfig.updateRequestBody) {
      postBody = processBody(recordConfig.updateRequestBody, originalBody);
    }
    ctx.proxyToServerRequest?.setHeader('Content-Length', Buffer.byteLength(postBody));
    ctx.proxyToServerRequest?.write(postBody);
    callback();
  });
}

export function modifyResponseBody(ctx: IContext, recordConfig: RecordConfig) {
    const responseBodyChunks: Buffer[] = [];

    // Collect response data chunks
    ctx.onResponseData((ctx: IContext, chunk: Buffer, callback: OnRequestDataCallback) => {
      responseBodyChunks.push(chunk);
      return callback(null, undefined);
    });
  
    // Handle end of response data
    ctx.onResponseEnd((ctx: IContext, callback: OnRequestDataCallback) => {
      const responseBody = Buffer.concat(responseBodyChunks).toString('utf8');
      const statusCode = recordConfig.statusCode ?? ctx.serverToProxyResponse?.statusCode as number;
      try {
        ctx.proxyToClientResponse.writeHead(statusCode);
      } catch (error) {
        log.error(`Error occurred while writing status code to response for URL: ${recordConfig.url}`);
      }
      try {
        ctx.proxyToClientResponse.write(responseBody);
      } catch (error) {
        log.error(`Error occurred while writing response body for URL: ${recordConfig.url}`);
      }
      callback(null);
    });
}


export function compileRecordConfig(records: Array<RecordConfig>) {
  const compiledRecord: RecordConfig = {
    url: '',
    updateUrl: [],
    headers: {
      add: {},
      remove: [],
    },
    responseHeaders: {
      add: {},
      remove: [],
    },
    updateRequestBody: [],
  };

  records.reduce((finalRecord, record) => {
    return _.mergeWith(finalRecord, record, (objValue, srcValue) => {
      if (_.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
    });
  }, compiledRecord);

  return compiledRecord;
}

export function sleep(timeMs: number) {
  return new Promise((resolve) => setTimeout(resolve, timeMs));
}