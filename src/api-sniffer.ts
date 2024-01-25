import { RequestInfo, SniffConfig } from './types';
import { doesUrlMatch } from './utils/proxy';

export class ApiSniffer {
  private readonly requests: RequestInfo[] = [];

  constructor(private id: string, private config: SniffConfig) {}

  getId() {
    return this.id;
  }

  onApiRequest(request: RequestInfo) {
    if (this.doesRequestMatchesConfig(request)) {
      this.requests.push(request);
    }
  }

  getRequests() {
    return this.requests;
  }

  private doesRequestMatchesConfig(request: RequestInfo) {
    const doesIncludeRuleMatches = !this.config.include
      ? true
      : this.config.include.some((config) => doesUrlMatch(config.url, request.url));
    const doesExcludeRuleMatches = !this.config.exclude
      ? true
      : !this.config.exclude.some((config) => doesUrlMatch(config.url, request.url));

    return doesIncludeRuleMatches && doesExcludeRuleMatches;
  }
}
