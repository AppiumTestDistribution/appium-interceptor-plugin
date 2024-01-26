import { EventEmitter } from 'events';
import { RequestInfo, SniffConfig } from './types';
import { doesUrlMatch } from './utils/proxy';

export class ApiSniffer extends EventEmitter {
  private readonly requests: RequestInfo[] = [];

  constructor(private id: string, private config: SniffConfig) {
    super();
  }

  getId() {
    return this.id;
  }

  onApiRequest(request: RequestInfo) {
    if (this.doesRequestMatchesConfig(request)) {
      this.requests.push(request);
      this.notify(request);
    }
  }

  private notify(request: RequestInfo) {
    this.emit('request', request);
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
