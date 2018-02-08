import { Request, Response } from 'express';
import { EventEmitter } from 'events';
import { KrasInjector } from './kras-injector';
import { KrasRecorder } from './kras-recorder';
import { LogEntry } from './kras-basics';

export interface KrasServerHook {
  handle(req: Request, res: Response): void;
  rate(req: Request): number;
}

export interface KrasServerHandler {
  (req: Request, res: Response): void;
}

export type KrasWebSocket = EventEmitter & {
  send(msg: string): void;
};

export interface KrasServerConnector {
  (ws: KrasWebSocket, req: Request): void;
}

export interface KrasServerMethods {
  get(handler: KrasServerHandler): KrasServerMethods;
  put(handler: KrasServerHandler): KrasServerMethods;
  post(handler: KrasServerHandler): KrasServerMethods;
  delete(handler: KrasServerHandler): KrasServerMethods;
  feed(handler: KrasServerConnector): KrasServerMethods;
}

export interface BaseKrasServer extends EventEmitter {
  add(hook: KrasServerHook): void;
  remove(hook: KrasServerHook): void;
  at(...segments: Array<string>): KrasServerMethods;
  broadcast<T>(msg: T): void;
  ws: boolean;
}

export interface KrasServer extends BaseKrasServer {
  readonly injectors: Array<KrasInjector>;
  readonly recorder: KrasRecorder;
  readonly logs: Array<LogEntry>;
}
