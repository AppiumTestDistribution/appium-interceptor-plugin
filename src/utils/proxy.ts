import { IContext, OnRequestDataCallback } from 'http-mitm-proxy';
import { ApiMock, HttpHeader, UrlPattern } from '../types';
import _ from 'lodash';
import getPort from 'get-port';
import { Proxy } from '../proxy';
import ip from 'ip';
import os from 'os';
import path from 'path';
import config from '../config';
import fs from 'fs-extra';
import RegexParser from 'regex-parser';
import { minimatch } from 'minimatch';
import http from 'http';

const MOCK_BACKEND_HTML = `<html><head><title>Appium Mock</title></head>
<body style="display:flex;flex-direction:column;align-items:center;justify-content:center">
<h1>Hurray 🎉</h1>
<p style="font-size:24px">Your device is successfully connected to appium interceptor plugin</p>
<p style="font-size:24px">Download the certificate <a href="www.google.com">here</a></p>
</body></html>`;

export function constructURLFromRequest(request: { protocol: string; path: string; host: string }) {
  const urlString = `${request.protocol}${request?.host}${request.path}`;
  return new URL(urlString);
}

export function updateRequestUrl(ctx: IContext, apiMock: ApiMock) {
  if (!apiMock.updateUrl) {
    return;
  }

  if (ctx.clientToProxyRequest?.headers.host && ctx.proxyToServerRequestOptions?.host) {
    let request = ctx.clientToProxyRequest;
    const originalUrl = constructURLFromRequest({
      host: request.headers.host!,
      path: request.url!,
      protocol: ctx.isSSL ? 'https://' : 'http://',
    });

    let matchers = _.isArray(apiMock.updateUrl) ? apiMock.updateUrl : [apiMock.updateUrl];
    let updatedUrlString = originalUrl.toString();
    for (let matcher of matchers) {
      updatedUrlString = updatedUrlString.replace(
        parseRegex(matcher.pattern as string),
        matcher.replaceWith
      );
    }

    const updatedUrl = new URL(updatedUrlString);
    ctx.proxyToServerRequestOptions.host = updatedUrl.hostname;
    ctx.proxyToServerRequestOptions.path = `${updatedUrl.pathname}${updatedUrl.search}`;
    ctx.proxyToServerRequestOptions.port = updatedUrl.port || ctx.proxyToServerRequestOptions.port;
  }
}

export function updateRequestHeaders(ctx: IContext, apiMock: ApiMock) {
  if (!apiMock.headers) {
    return;
  }

  let headersToBeAdded: Record<string, string> = {};
  let headersToBeDeleted = [];

  if (apiMock.headers.hasOwnProperty('add') || apiMock.headers.hasOwnProperty('remove')) {
    if (!_.isNil(apiMock.headers.add) && typeof apiMock.headers.add === 'object') {
      headersToBeAdded = apiMock.headers.add || ({} as any);
    }

    if (!_.isNil(apiMock.headers.remove) && _.isArray(apiMock.headers.remove)) {
      headersToBeDeleted = apiMock.headers.remove;
    }
  } else {
    headersToBeAdded = apiMock.headers as any;
  }

  if (ctx.proxyToServerRequestOptions) {
    Object.keys(headersToBeAdded).forEach((key) => {
      ctx.proxyToServerRequestOptions!.headers[key] = headersToBeAdded[key];
    });

    headersToBeDeleted.forEach((header) => {
      delete ctx.proxyToServerRequestOptions!.headers[header];
    });
  }
}

export function updateRequestBody(ctx: IContext, apiMock: ApiMock) {
  if (!apiMock.postBody) {
    return;
  }

  const requestBodyChunks: Array<Buffer> = [];
  ctx.onRequestData((ctx: IContext, chunk: Buffer, callback: OnRequestDataCallback) => {
    requestBodyChunks.push(chunk);
    callback(null, undefined);
  });
  ctx.onRequestEnd((ctx: IContext, callback: OnRequestDataCallback) => {
    const originalBody = Buffer.concat(requestBodyChunks).toString('utf-8');
    ctx.proxyToServerRequest?.write(apiMock.postBody || originalBody);
    callback();
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
  proxy.stop();
  fs.rmdirSync(proxy.getCertificatePath());
}

function prepareCertificate(sessionId: string) {
  const sessionCertDirectory = path.join(os.tmpdir(), sessionId);
  fs.copySync(config.certDirectory, sessionCertDirectory);
  return sessionCertDirectory;
}

export function parseRegex(matcherString: string) {
  try {
    return RegexParser(matcherString);
  } catch (err) {
    return matcherString;
  }
}

export function addDefaultMocks(proxy: Proxy) {
  proxy.addMock({
    url: '**/reqres.in/api/**',
    statusCode: 400,
  });

  proxy.addMock({
    url: '**/api/users*?*',
    updateUrl: {
      pattern: new RegExp(/page=(\d)+/g),
      replaceWith: 'page=9',
    },
  });

  proxy.addMock({
    url: new RegExp(/appiumproxy.io/g),
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
  let jsonOrStringUrl = parseJson(pattern);
  if (typeof jsonOrStringUrl === 'string') {
    jsonOrStringUrl = parseRegex(jsonOrStringUrl);
    if (jsonOrStringUrl instanceof RegExp) {
      return jsonOrStringUrl.test(url);
    } else {
      return minimatch(url, jsonOrStringUrl);
    }
  } else if (jsonOrStringUrl instanceof RegExp) {
    return jsonOrStringUrl.test(url);
  }
  return false;
}

export function matchHttpMethod(request: http.IncomingMessage, method: string | undefined) {
  if (!method) {
    return true;
  }
  return request.method && request.method.toLowerCase() == method.toLowerCase();
}

export function compileApiMock(mocks: Array<ApiMock>) {
  const compiledMock: ApiMock = {
    url: '',
    headers: {
      add: {},
      remove: [],
    },
    responseHeaders: {
      add: {},
      remove: [],
    },
  };

  mocks.forEach((mock) => {
    const requestHeaders = parseMockHeader(mock.headers);
    const responseHeaders = parseMockHeader(mock.responseHeaders);

    _.merge(compiledMock.headers!.add, requestHeaders.add);
    _.concat(compiledMock.headers!.remove, requestHeaders.remove);

    _.merge(compiledMock.responseHeaders!.add, responseHeaders.add);
    _.concat(compiledMock.responseHeaders!.remove, responseHeaders.remove);

    if (mock.postBody) {
      compiledMock.postBody = mock.postBody;
    }
    if (mock.responseBody) {
      compiledMock.responseBody = mock.responseBody;
    }
    if (mock.statusCode) {
      compiledMock.statusCode = mock.statusCode;
    }
    if (mock.updateUrl) {
      compiledMock.updateUrl = mock.updateUrl;
    }
  });

  return compiledMock;
}

function parseMockHeader(header?: HttpHeader) {
  let add = {},
    remove: string[] = [];

  if (header) {
    const parsedHeader = parseJson(header);
    if (typeof parsedHeader === 'object') {
      if (parsedHeader && parsedHeader.add) {
        add = parsedHeader.add;
      } else if (parsedHeader && parsedHeader.remove) {
        remove = parsedHeader.remove;
      } else {
        add = parsedHeader;
      }
    }
  }

  return {
    add,
    remove,
  };
}
