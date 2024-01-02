import { IContext, OnRequestDataCallback } from 'http-mitm-proxy';
import { ApiMock } from '../types';
import _ from 'lodash';
import getPort from 'get-port';
import { Proxy } from '../proxy';
import ip from 'ip';
import os from 'os';
import path from 'path';
import config from '../config';
import fs from 'fs-extra';
import RegexParser from 'regex-parser';

export function updateRequestUrl(ctx: IContext, apiMock: ApiMock) {
  if (!apiMock.updateUrl) {
    return;
  }

  if (ctx.proxyToServerRequestOptions?.host) {
    const urlString = `${ctx.isSSL ? 'https://' : 'http://'}${
      ctx.proxyToServerRequestOptions?.host
    }${ctx.proxyToServerRequestOptions.port ? ':' + ctx.proxyToServerRequestOptions.port : ''}${
      ctx.proxyToServerRequestOptions.path
    }`;

    let originalUrl = new URL(urlString);

    let updatedUrlString = originalUrl.toString();
    let matchers = _.isArray(apiMock.updateUrl) ? apiMock.updateUrl : [apiMock.updateUrl];

    for (let matcher of matchers) {
      updatedUrlString = updatedUrlString.replace(
        getReplacer(matcher.pattern as string),
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

  if (!!ctx.proxyToServerRequestOptions) {
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

export function getReplacer(matcherString: string) {
  try {
    return RegexParser(matcherString);
  } catch (err) {
    return matcherString;
  }
}
