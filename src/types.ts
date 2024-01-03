export type CliArg = Record<string, unknown>;

export type ISessionCapability = {
  firstMatch: any[];
  alwaysMatch: any;
};

export type UrlPattern = string | RegExp;
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

export type PaternReplacer = {
  pattern: string | RegExp;
  replaceWith: string;
};

export interface ApiMock {
  url: UrlPattern;
  method?: string;
  updateUrl?: PaternReplacer | Array<PaternReplacer>;
  headers?: HttpHeader;
  postBody?: HttpBody;
  statusCode?: number;
  responseHeaders?: HttpHeader;
  responseBody?: HttpBody;
}

// string mockiD = driver.executeScript("intercept:addMock", {
//   url:
//   method:
// })

//mockiD
