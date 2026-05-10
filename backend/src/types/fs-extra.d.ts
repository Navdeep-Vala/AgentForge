declare module 'fs-extra' {
  import * as fs from 'fs';
  import * as path from 'path';

  export function ensureDir(dir: string): Promise<void>;
  export function ensureDirSync(dir: string): void;
  export function ensureFileSync(file: string): void;
  export function ensureLinkSync(existing: string, newpath: string): void;
  export function ensureSymlinkSync(existing: string, newpath: string, type?: string): void;
  export function ensureLink(existing: string, newpath: string): Promise<void>;
  export function ensureSymlink(existing: string, newpath: string, type?: string): Promise<void>;
  export function mkdirp(dir: string): Promise<string | undefined>;
  export function mkdirpSync(dir: string): string | undefined;
  export function mkdirs(dir: string): Promise<string | undefined>;
  export function mkdirsSync(dir: string): string | undefined;
  export function outputFile(file: string, data: string): Promise<void>;
  export function outputFileSync(file: string, data: string): void;
  export function outputJson(file: string, data: object): Promise<void>;
  export function outputJsonSync(file: string, data: object): void;
  export function readJson(file: string): Promise<any>;
  export function readJsonSync(file: string): any;
  export function writeJson(file: string, data: object): Promise<void>;
  export function writeJsonSync(file: string, data: object): void;
  export function remove(path: string): Promise<void>;
  export function removeSync(path: string): void;
  export function emptyDir(dir: string): Promise<void>;
  export function emptyDirSync(dir: string): void;
  export function ensureDirSync(dir: string): void;
  export function pathExists(path: string): Promise<boolean>;
  export function pathExistsSync(path: string): boolean;
  export { fs };
}