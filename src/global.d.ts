// src/global.d.ts

declare module "*.svelte" {
  import { SvelteComponent } from "svelte";
  export default SvelteComponent;
}

// Node.js modules for settings validation
declare module "child_process" {
  export function exec(command: string, options?: any, callback?: (error: any, stdout: string, stderr: string) => void): any;
}

declare module "util" {
  export function promisify(fn: Function): Function;
}

declare module "fs" {
  export function existsSync(path: string): boolean;
}

declare module "path" {
  export function resolve(...paths: string[]): string;
}