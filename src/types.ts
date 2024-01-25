export type CliArg = Record<string, unknown>;

export type ISessionCapability = {
  firstMatch: any[];
  alwaysMatch: any;
};

export type UrlPattern = string;
export type HttpHeader =
  | Record<string, unknown>
  | {
      add: Record<string, string>;
      remove: string[];
    };

export type JsonPathReplacer = {
  jsonPath: string;
  value: string;
};

export type RegExpReplacer = {
  regexp: string;
  value: string;
};

export type UpdateBodySpec = JsonPathReplacer | RegExpReplacer;

export type MockConfig = {
  url: UrlPattern;
  method?: string;
  updateUrl?: RegExpReplacer[];
  headers?: HttpHeader;
  requestBody?: string;
  updateRequestBody?: UpdateBodySpec[];
  statusCode?: number;
  responseHeaders?: HttpHeader;
  responseBody?: string;
  updateResponseBody?: UpdateBodySpec[];
};

export type SniffConfig = {
  include?: Array<{ url: UrlPattern }>;
  exclude?: Array<{ url: UrlPattern }>;
};

export type RequestInfo = {
  url: string;
  method: string;
  requestBody: any;
  statusCode: number;
  requestHeaders: Record<string, string | string[]>;
  responseBody: any;
  responseHeaders: Record<string, string | string[]>;
};
