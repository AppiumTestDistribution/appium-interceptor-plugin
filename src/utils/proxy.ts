import { IContext, OnRequestDataCallback } from 'http-mitm-proxy';
import {
  MockConfig,
  HttpHeader,
  JsonPathReplacer,
  RegExpReplacer,
  UpdateBodySpec,
  UrlPattern,
} from '../types';
import _ from 'lodash';
import getPort from 'get-port';
import { Proxy } from '../proxy';
import ip from 'ip';
import os from 'os';
import path from 'path';
import config from '../config';
import fs from 'fs-extra';
import { minimatch } from 'minimatch';
import http from 'http';
import jsonpath from 'jsonpath';
import regexParser from 'regex-parser';
import { validateMockConfig } from '../schema';
import log from '../logger';

const MOCK_BACKEND_HTML = `<html><head><title>Appium Mock</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center">
<h1>Hurray</h1>
<p style="font-size:24px">Your device is successfully connected to appium interceptor plugin</p>
<p style="font-size:24px">Download the certificate <a href="www.google.com">here</a></p>
</body></html>`;

export function constructURLFromRequest(request: { protocol: string; path: string; host: string }) {
  const urlString = `${request.protocol}${request?.host}${request.path}`;
  return new URL(urlString);
}

export function updateRequestUrl(ctx: IContext, mockConfig: MockConfig) {
  if (!mockConfig.updateUrl || !ctx.clientToProxyRequest || !ctx.proxyToServerRequestOptions) {
    return;
  }

  const { headers, url } = ctx.clientToProxyRequest;
  const protocol = ctx.isSSL ? 'https://' : 'http://';
  const originalUrl = constructURLFromRequest({
    host: headers.host!,
    path: url!,
    protocol,
  });

  const updateUrlMatchers = _.castArray(mockConfig.updateUrl);
  const updatedUrlString = updateUrlMatchers.reduce((current, matcher) => {
    return current.replace(parseRegex(matcher.regexp as string), matcher.value);
  }, originalUrl.toString());

  const updatedUrl = new URL(updatedUrlString);
  ctx.proxyToServerRequestOptions.host = updatedUrl.hostname;
  ctx.proxyToServerRequestOptions.path = `${updatedUrl.pathname}${updatedUrl.search}`;
  ctx.proxyToServerRequestOptions.port = updatedUrl.port || ctx.proxyToServerRequestOptions.port;
}

export function updateRequestHeaders(ctx: IContext, mockConfig: MockConfig) {
  if (!mockConfig.headers || !ctx.proxyToServerRequestOptions) {
    return;
  }

  const { headers } = ctx.proxyToServerRequestOptions;
  if (mockConfig.headers?.add) {
    Object.assign(headers, mockConfig.headers.add);
  }
  if (mockConfig.headers?.remove && Array.isArray(mockConfig.headers?.remove)) {
    mockConfig.headers.remove.forEach((header: string) => delete headers[header]);
  }
}

export function updateRequestBody(ctx: IContext, mockConfig: MockConfig) {
  const requestBodyChunks: Buffer[] = [];
  ctx.onRequestData((ctx: IContext, chunk: Buffer, callback: OnRequestDataCallback) => {
    requestBodyChunks.push(chunk);
    callback(null, undefined);
  });
  ctx.onRequestEnd((ctx: IContext, callback: OnRequestDataCallback) => {
    const originalBody = Buffer.concat(requestBodyChunks).toString('utf-8');
    let postBody = mockConfig.requestBody || originalBody;
    if (mockConfig.updateRequestBody) {
      postBody = processBody(mockConfig.updateRequestBody, originalBody);
    }
    if (postBody) {
      console.log('************* REQUEST BODY **************************');
      console.log(postBody);
    }
    ctx.proxyToServerRequest?.setHeader('Content-Length', Buffer.byteLength(postBody));
    ctx.proxyToServerRequest?.write(postBody);
    callback();
  });
}

export function updateResponseBody(ctx: IContext, mockConfig: MockConfig) {
  const responseBodyChunks: Buffer[] = [];
  ctx.onResponseData((ctx: IContext, chunk: Buffer, callback: OnRequestDataCallback) => {
    responseBodyChunks.push(chunk);
    return callback(null, undefined);
  });
  ctx.onResponseEnd((ctx: IContext, callback: OnRequestDataCallback) => {
    const originalResponse = Buffer.concat(responseBodyChunks).toString('utf8');
    let responseBody = mockConfig.responseBody || originalResponse;
    //console.log(originalResponse);

    if (mockConfig.statusCode) {
      ctx.proxyToClientResponse.writeHead(mockConfig.statusCode);
    }
    if (mockConfig.updateResponseBody) {
      responseBody = processBody(mockConfig.updateResponseBody, responseBody);
    }
    ctx.proxyToClientResponse.write(responseBody);
    callback(null);
  });
}

export async function setupProxyServer(
  sessionId: string,
  deviceUDID: string,
  isRealDevice: boolean
) {
  const certificatePath = prepareCertificate(sessionId);
  const port = await getPort();
  const _ip = isRealDevice ? 'localhost' : ip.address('public', 'ipv4');
  const proxy = new Proxy({ deviceUDID, sessionId, certificatePath, port, ip: _ip });
  await proxy.start();
  if (!proxy.isStarted()) {
    throw new Error('Unable to start the proxy server');
  }
  return proxy;
}

export async function cleanUpProxyServer(proxy: Proxy) {
  await proxy.stop();
  // @ts-ignore
  fs.rmdirSync(proxy.getCertificatePath(), { recursive: true, force: true });
}

function prepareCertificate(sessionId: string) {
  const sessionCertDirectory = path.join(os.tmpdir(), sessionId);
  fs.copySync(config.certDirectory, sessionCertDirectory);
  return sessionCertDirectory;
}

export function parseRegex(matcherString: string) {
  try {
    return regexParser(matcherString);
  } catch (err) {
    return matcherString;
  }
}

export function addDefaultMocks(proxy: Proxy) {
  // proxy.addMock({
  //   url: '**/reqres.in/api/**',
  //   statusCode: 400,
  // });

  proxy.addMock({
    url: '**/api/login',
    method: 'post',
    updateRequestBody: [
      {
        jsonPath: '$.email',
        value: 'invalidemail@reqres.in',
      },
    ],
  });

  // proxy.addMock({
  //   // url: '**/api/users*?*',
  //   // url: '/api/users?.*',
  //   // updateUrl: [
  //   //   {
  //   //     regexp: '/page=(\\d)+/g',
  //   //     value: 'page=2',
  //   //   },
  //   // ],
  //   // updateResponseBody: [
  //   //   {
  //   //     jsonPath: '$.data[?(/michael.*/.test(@.email))].first_name',
  //   //     value: 'sudharsan',
  //   //   },
  //   //   {
  //   //     jsonPath: '$.data[?(/michael.*/.test(@.email))].last_name',
  //   //     value: 'selvaraj',
  //   //   },
  //   // ],
  // });

  proxy.addMock({
    url: '/appiumproxy.io/g',
    responseBody: MOCK_BACKEND_HTML,
    statusCode: 200,
  });
}

export function parseJson(obj: any) {
  try {
    return JSON.parse(obj);
  } catch (err) {
    return obj;
  }
}

export function matchUrl(pattern: UrlPattern, url: string) {
  let jsonOrStringUrl = parseRegex(pattern);

  try {
    return jsonOrStringUrl instanceof RegExp
      ? jsonOrStringUrl.test(url)
      : minimatch(url, jsonOrStringUrl);
  } catch (err) {
    log.error(`Error validaing url ${pattern} against url ${url}`);
    return false;
  }
}

export function matchHttpMethod(request: http.IncomingMessage, method: string | undefined) {
  if (!method) {
    return true;
  }
  return request.method && request.method.toLowerCase() == method.toLowerCase();
}

export function compileMockConfig(mocks: Array<MockConfig>) {
  const compiledMock: MockConfig = {
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
    updateResponseBody: [],
  };

  mocks.reduce((finalMock, mock) => {
    return _.mergeWith(finalMock, mock, (objValue, srcValue) => {
      if (_.isArray(objValue)) {
        return objValue.concat(srcValue);
      }
    });
  }, compiledMock);

  return compiledMock;
}

export function updateUsingJsonPath(spec: JsonPathReplacer, body: string) {
  const parsedBody = parseJson(body);
  if (typeof parsedBody !== 'object') {
    return body;
  }
  const { jsonPath: path, value } = spec;

  jsonpath.apply(parsedBody, path, (val) => value);

  return JSON.stringify(parsedBody);
}

export function updateUsingRegExp(spec: RegExpReplacer, body: string) {
  const { regexp, value } = spec;
  return body.replace(new RegExp(regexp), value);
}

export function processBody(spec: UpdateBodySpec[], body: string) {
  return spec.reduce((body: string, spec: UpdateBodySpec) => {
    if (_.has(spec, 'jsonPath')) {
      return updateUsingJsonPath(spec as JsonPathReplacer, body);
    } else if (_.has(spec, 'regexp')) {
      return updateUsingRegExp(spec as RegExpReplacer, body);
    }
    return body;
  }, body);
}

function parseHeaderConfig(header?: HttpHeader) {
  const parsedHeader = typeof header === 'string' ? parseJson(header) : header;
  if (!parsedHeader || typeof parsedHeader !== 'object') return { add: {}, remove: [] };

  return {
    add: parsedHeader?.add ? parsedHeader.add : parsedHeader,
    remove: parsedHeader?.remove ?? [],
  };
}

export function sanitizeMockConfig(config: MockConfig) {
  const isValid = validateMockConfig(config);
  if (!isValid) {
    throw new Error('Invalid config provided for api mock');
  }
  config.headers = parseHeaderConfig(config.headers);
  config.responseHeaders = parseHeaderConfig(config.headers);

  /* Validate if the config has corrent RegExp */
  [
    '$.updateUrl[*].regexp',
    '$.updateRequestBody[*].regexp',
    '$.updateResponseBody[*].regexp',
  ].forEach((regexNodePath) => {
    const regexElement = jsonpath.query(config, regexNodePath);
    return regexElement.forEach((ele) => {
      console.log('00000', ele)
      const isValidRegExp = typeof ele === 'string' && !(parseRegex(ele) instanceof RegExp);
      if (!isValidRegExp) {
        throw new Error(`Invalid Regular expression ${ele} for field ${regexNodePath}`);
      }
    });
  });

  return config;
}
