export type CliArg = Record<string, unknown>;

export type ISessionCapability = {
  firstMatch: any[];
  alwaysMatch: any;
};

export type Url = string | RegExp;
export type HttpHeader =
  | Record<string, unknown>
  | {
      add: Record<string, string>;
      remove: string[];
    };

export type HttpBody =
  | string
  | { contentType: string; body: string }
  | PaternReplacer
  | Array<PaternReplacer>;

export type RequestMatcher =
  | Url
  | {
      path: Url;
      method: string;
    };

export type PaternReplacer = {
  pattern: string | RegExp;
  replaceWith: string;
};

export interface ApiMock {
  url: Url;
  method?: string;
  updateUrl?: PaternReplacer | Array<PaternReplacer>;
  headers?: HttpHeader;
  postBody?: HttpBody;
  statusCode?: number;
  responseHeaders?: HttpHeader;
  responseBody?: HttpBody;
}
