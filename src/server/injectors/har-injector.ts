import { asJson, watch } from '../helpers/io';
import { basename } from 'path';
import { editFileOption } from '../helpers/build-options';
import { fromHar, HarResponse, HarRequest, HarHeaders } from '../helpers/build-response';
import { compareRequests } from '../helpers/compare-requests';
import { KrasInjector, KrasInjectorConfig, KrasConfiguration, KrasRequest, KrasAnswer, Headers, StoredFileEntry, KrasInjectorOptions } from '../types';

function delay<T>(value: T, time: number) {
  if (time) {
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => resolve(value), time);
    });
  }

  return value;
}

function ato(arr: HarHeaders) {
  const obj: Headers = {};

  for (const item of (arr || [])) {
    obj[item.name] = item.value;
  }

  return obj;
}

function getUrl(url: string) {
  if (url.startsWith('http')) {
    return url.substr(url.indexOf('/', 9));
  }

  return url;
}

function findEntries(obj: HarContent) {
  if (typeof obj === 'object' && obj.log && Array.isArray(obj.log.entries)) {
    return obj.log.entries;
  }

  return [];
}

interface HarContent {
  log?: {
    entries?: Array<HttpArchive>;
  }
}

interface HttpArchive {
  active: boolean;
  request: HarRequest;
  response: HarResponse;
  time: number;
}

interface HarFileEntry {
  active: boolean;
  request: {
    method: string;
    url: string;
    target: string;
    content: string;
    headers: Headers;
    query: Headers;
  };
  response: HarResponse;
  time: number;
}

interface HarFiles {
  [file: string]: Array<HarFileEntry>;
}

export interface HarInjectorConfig {
  directory?: string | Array<string>;
  delay?: boolean;
}

export interface DynamicHarInjectorConfig {
  [id: string]: boolean;
}

export default class HarInjector implements KrasInjector {
  private readonly db: HarFiles = {};
  private readonly options: KrasInjectorConfig & HarInjectorConfig;
  private readonly map: {
    [target: string]: string;
  };

  constructor(options: KrasInjectorConfig & HarInjectorConfig, config: KrasConfiguration) {
    const directory = options.directory || config.directory;
    this.options = options;
    this.map = config.map;

    watch(directory, '**/*.har', (ev, file) => {
      switch (ev) {
        case 'create':
        case 'update':
          return this.load(file);
        case 'delete':
          delete this.db[file];
          return;
      }
    });
  }

  getOptions(): KrasInjectorOptions {
    const options: KrasInjectorOptions = {};
    const fileNames = Object.keys(this.db);

    for (const fileName of fileNames) {
      const items = this.db[fileName];
      options[`_${fileName}`] = editFileOption(fileName);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const id = `${fileName}#${i}`;
        options[id] = {
          description: `#${i + 1} of ${fileName} - ${item.request.method} ${item.request.url}.`,
          title: basename(fileName),
          type: 'checkbox',
          value: item.active,
        };
      }
    }

    return options;
  }

  setOptions(options: DynamicHarInjectorConfig): void {
    const entries = Object.keys(options).map(option => ({
      file: option.substr(0, option.indexOf('#')),
      id: +option.substr(option.indexOf('#') + 1),
      active: options[option],
    }));

    this.setAllEntries(entries);
  }

  get name() {
    return 'har-injector';
  }

  get active() {
    return this.options.active;
  }

  set active(value: boolean) {
    this.options.active = value;
  }

  private load(file: string) {
    this.db[file] = findEntries(asJson(file))
      .map(entry => this.transformEntry(entry));
  }

  private findTarget(url: string) {
    for (const target of Object.keys(this.map)) {
      if (url.indexOf(this.map[target])) {
        return target;
      }
    }

    return undefined;
  }

  private transformEntry(entry: HttpArchive) {
    const original = entry.request;
    const response = entry.response;
    const request = {
      method: original.method,
      url: getUrl(original.url),
      target: original.target || this.findTarget(original.url),
      content: (original.postData || {}).text || '',
      headers: ato(original.headers),
      query: ato(original.queryString),
    };

    delete request.headers['_'];

    return {
      active: true,
      time: entry.time,
      request,
      response,
    };
  }

  private setAllEntries(entries: Array<{ file: string, id: number, active: boolean }>) {
    for (const entry of entries) {
      const items = this.db[entry.file];

      if (items) {
        const item = items[entry.id];

        if (item) {
          item.active = entry.active;
        }
      }
    }
  }

  handle(req: KrasRequest) {
    for (const file of Object.keys(this.db)) {
      const entries = this.db[file];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        if (entry.active) {
          const item = entry.request;
          const name = this.name;

          if (compareRequests(item, req)) {
            return delay(fromHar(item.url, entry.response, {
              name,
              file: {
                name: file,
                entry: i,
              }
            }), this.options.delay && entry.time);
          }
        }
      }
    }
  }
}
