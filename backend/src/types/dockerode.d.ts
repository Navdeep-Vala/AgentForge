declare module 'dockerode' {
  export default class Docker {
    constructor(opts?: any);
    createContainer(opts: any): Promise<Container>;
    getContainer(id: string): Container;
  }

  export interface Container {
    start(): Promise<void>;
    stop(): Promise<void>;
    remove(opts?: any): Promise<void>;
    exec(opts: any): Promise<ExecInstance>;
    logs(opts: any): NodeJS.ReadableStream;
    inspect(): Promise<any>;
  }

  export interface ExecInstance {
    kill(): Promise<void>;
    stdout: NodeJS.ReadableStream;
    stderr: NodeJS.ReadableStream;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}