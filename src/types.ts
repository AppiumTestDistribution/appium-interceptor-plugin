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

export type PaternReplacer = {
  pattern: string | RegExp;
  replaceWith: string;
};

export interface MockConfig {
  url: UrlPattern;
  method?: string;
  updateUrl?: PaternReplacer[];
  headers?: HttpHeader;
  requestBody?: string;
  updateRequestBody?: UpdateBodySpec[];
  statusCode?: number;
  responseHeaders?: HttpHeader;
  responseBody?: string;
  updateResponseBody?: UpdateBodySpec[];
}
