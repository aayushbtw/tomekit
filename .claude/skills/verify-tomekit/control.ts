#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const REPO = path.resolve(import.meta.dirname, "../../..");
const PACKAGE = path.join(REPO, "packages/tomekit");
const ROOT =
  process.env.VERIFY_TOMEKIT_ROOT ?? path.join(os.tmpdir(), "verify-tomekit");
const DIRS = {
  evidence: path.join(ROOT, "evidence"),
  pids: path.join(ROOT, "pids"),
  scratch: path.join(ROOT, "scratch"),
};
const COPY_SKIP = new Set([
  "node_modules",
  ".tomekit",
  ".output",
  ".react-router",
  "build",
  "dist",
]);

type Json =
  | boolean
  | number
  | string
  | null
  | undefined
  | readonly Json[]
  | { readonly [key: string]: Json };

type Report = Readonly<Record<string, Json>>;

type Check = Readonly<{ check: string; detail: string; ok: boolean }>;

interface Args {
  label: string | undefined;
  positional: string[];
  tail: string[];
  timeout: string | undefined;
}

function listExamples(): string[] {
  return fs
    .readdirSync(path.join(REPO, "examples"))
    .filter((name) =>
      fs.existsSync(path.join(REPO, "examples", name, "package.json"))
    );
}

const HELP = `Usage: node .claude/skills/verify-tomekit/control.ts <command> [args]

Every command prints JSON on stdout. Exit code 1 means the command itself failed.

  doctor                         Is the repo ready to verify? (node, vp, built dist)
  scratch <example>              Copy examples/<example> outside the repo, link it to the
                                 local packages/tomekit, and install. Prints its dir.
  run <dir> [--label L] [--timeout MS] -- <cmd...>
                                 Run a command in <dir>, save stdout, stderr and exit code
                                 as evidence. A non-zero exit is recorded, not a failure.
                                 Stops the command after --timeout (default 120000), eg
                                 to capture a \`tomekit watch\` that never exits.
  dev start <dir>                Start the example's dev server on a free port. Prints its url.
  dev fetch <url> [--label L]    GET a page from a dev server, save the HTML as evidence.
  dev stop <port>                Stop a dev server this script started.
  cleanup [--dry-run]            Stop servers and delete scratch dirs. Keeps evidence.

Examples: ${listExamples().join(", ")}
Working root: ${ROOT}`;

function out(value: Report): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  out({ error: message });
  process.exit(1);
}

function stamp(label: string): string {
  const time = new Date().toISOString().replaceAll(/[:.]/gu, "-");

  return `${time}-${label.replaceAll(/[^\w-]/gu, "_")}`;
}

function ensureDirs(): void {
  for (const dir of Object.values(DIRS)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function newestMtime(dir: string): number {
  let newest = 0;

  for (const entry of fs.readdirSync(dir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isFile()) {
      newest = Math.max(
        newest,
        fs.statSync(path.join(entry.parentPath, entry.name)).mtimeMs
      );
    }
  }

  return newest;
}

function git(...args: string[]): string {
  return spawnSync("git", ["-C", REPO, ...args], {
    encoding: "utf-8",
  }).stdout.trim();
}

function doctor(): void {
  const checks: Check[] = [];
  const [major = "0"] = process.versions.node.split(".");

  checks.push({
    check: "node >= 24",
    detail: process.versions.node,
    ok: Number(major) >= 24,
  });

  const vp = spawnSync("vp", ["--version"], { encoding: "utf-8" });
  const [vpVersion = ""] = vp.stdout.split("\n");

  checks.push({
    check: "vp on PATH",
    detail: vp.status === 0 ? vpVersion : "not found. Install Vite+",
    ok: vp.status === 0,
  });

  const dist = path.join(PACKAGE, "dist/index.mjs");
  const built = fs.existsSync(dist);

  checks.push({
    check: "packages/tomekit is built",
    detail: built ? dist : "missing. Run `vpr build` in the repo root",
    ok: built,
  });

  if (built) {
    const fresh =
      fs.statSync(dist).mtimeMs >= newestMtime(path.join(PACKAGE, "src"));

    checks.push({
      check: "dist is newer than src",
      detail: fresh
        ? "fresh"
        : "src changed after the last build. Run `vpr build` in the repo root",
      ok: fresh,
    });
  }

  const ok = checks.every((check) => check.ok);

  out({
    checks,
    dirty: git("status", "--porcelain") !== "",
    head: git("rev-parse", "--short", "HEAD"),
    ok,
    root: ROOT,
  });

  if (!ok) {
    process.exit(1);
  }
}

function scratch([example = ""]: string[]): void {
  const examples = listExamples();

  if (!examples.includes(example)) {
    fail(`Unknown example "${example}". Use one of: ${examples.join(", ")}`);
  }

  ensureDirs();
  const dir = path.join(DIRS.scratch, stamp(example));

  fs.cpSync(path.join(REPO, "examples", example), dir, {
    filter: (source) => !COPY_SKIP.has(path.basename(source)),
    recursive: true,
  });

  const tomekit = `tomekit@file:${PACKAGE}`;
  const install = spawnSync("vp", ["add", tomekit], {
    cwd: dir,
    encoding: "utf-8",
  });

  if (install.status !== 0) {
    fail(`vp add failed in ${dir}:\n${install.stdout}\n${install.stderr}`);
  }

  out({ dir, example, tomekit });
}

function splitArgs(args: string[]): Args {
  const dash = args.indexOf("--");
  const head = dash === -1 ? args : args.slice(0, dash);
  const tail = dash === -1 ? [] : args.slice(dash + 1);
  const flags = new Map<string, string>();
  const positional: string[] = [];

  for (let index = 0; index < head.length; index += 1) {
    const arg = head[index] ?? "";
    const value = head[index + 1];

    if ((arg === "--label" || arg === "--timeout") && value !== undefined) {
      flags.set(arg, value);
      index += 1;
    } else {
      positional.push(arg);
    }
  }

  return {
    label: flags.get("--label"),
    positional,
    tail,
    timeout: flags.get("--timeout"),
  };
}

function requireDir(dir: string | undefined): string {
  if (dir === undefined || !fs.existsSync(path.join(dir, "package.json"))) {
    fail(
      `"${dir ?? ""}" is not a project dir. Pass the dir that \`scratch\` printed.`
    );
  }

  return path.resolve(dir);
}

function run(args: string[]): void {
  const { label, positional, tail, timeout } = splitArgs(args);
  const dir = requireDir(positional[0]);
  const [cmd, ...cmdArgs] = tail;

  if (cmd === undefined) {
    fail("No command given. Usage: run <dir> -- <cmd...>");
  }

  ensureDirs();
  const started = Date.now();
  const result = spawnSync(cmd, cmdArgs, {
    cwd: dir,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: Number(timeout ?? 120_000),
  });

  if (result.error && result.signal === null) {
    fail(`"${cmd}" failed to run: ${result.error.message}`);
  }

  const record = {
    cmd: tail.join(" "),
    cwd: dir,
    exit: result.status,
    ms: Date.now() - started,
    // Set when `--timeout` stopped the command, eg a `watch` that never exits.
    signal: result.signal,
    stderr: result.stderr,
    stdout: result.stdout,
  };
  const evidence = path.join(
    DIRS.evidence,
    `${stamp(label ?? path.basename(cmd))}.json`
  );

  fs.writeFileSync(evidence, `${JSON.stringify(record, null, 2)}\n`);
  out({
    ...record,
    evidence,
    stderr: record.stderr.slice(-4000),
    stdout: record.stdout.slice(-4000),
  });
}

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);

    return response.status < 500;
  } catch {
    return false;
  }
}

/** The url the dev server printed to its log, once it answers. Undefined if it exits or times out first. */
async function devUrl(
  log: string,
  child: ChildProcess,
  deadline: number
): Promise<string | undefined> {
  const url = /Local:\s+(?<url>http:\/\/[^\s/]+)/u.exec(
    fs.readFileSync(log, "utf-8")
  )?.groups?.url;

  if (url !== undefined && (await answers(url))) {
    return url;
  }

  if (child.exitCode !== null || Date.now() > deadline) {
    return undefined;
  }

  await sleep(500);

  return await devUrl(log, child, deadline);
}

async function devStart([dirArg]: string[]): Promise<void> {
  const dir = requireDir(dirArg);
  // React Router apps start through their own CLI; the rest through Vite.
  const bin = ["react-router", "vite"]
    .map((name) => path.join(dir, "node_modules/.bin", name))
    .find((file) => fs.existsSync(file));

  if (bin === undefined) {
    fail(`No dev server in ${dir}. Run \`scratch\` again.`);
  }

  ensureDirs();
  const log = path.join(DIRS.evidence, `${stamp("dev")}.log`);
  // One append-mode fd for both streams, so stderr lines aren't overwritten by stdout.
  const output = fs.openSync(log, "a");
  const child = spawn(bin, ["dev"], {
    cwd: dir,
    detached: true,
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", output, output],
  });

  child.unref();
  const url = await devUrl(log, child, Date.now() + 60_000);

  if (url === undefined || child.pid === undefined) {
    stopGroup(child.pid);
    fail(`Dev server exited or did not answer within 60s. Read ${log}.`);
  }

  const { port } = new URL(url);

  fs.writeFileSync(path.join(DIRS.pids, `${port}.pid`), String(child.pid));
  out({ dir, log, pid: child.pid, port: Number(port), url });
}

async function devFetch(args: string[]): Promise<void> {
  const { label, positional } = splitArgs(args);
  const [url] = positional;

  if (url === undefined || !url.startsWith("http")) {
    fail("Pass a full url, eg http://localhost:5173/posts/hello-world");
  }

  ensureDirs();
  let response: Response;

  try {
    response = await fetch(url);
  } catch (error) {
    fail(
      `Could not reach ${url}: ${String(error)}. Is the server up? Run \`dev start <dir>\`.`
    );
  }

  const html = await response.text();
  const evidence = path.join(
    DIRS.evidence,
    `${stamp(label ?? new URL(url).pathname)}.html`
  );

  fs.writeFileSync(evidence, html);
  const title = /<title>(?<text>[^<]*)<\/title>/u.exec(html)?.groups?.text;
  const h1 = /<h1[^>]*>(?<text>[^<]*)<\/h1>/u.exec(html)?.groups?.text;

  out({ evidence, h1, status: response.status, title, url });
}

/** Stops a detached server and every process it started. */
function stopGroup(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // Already gone, which is the state we want.
  }
}

function stopPid(pidFile: string): number {
  const pid = Number(fs.readFileSync(pidFile, "utf-8"));

  stopGroup(pid);
  fs.rmSync(pidFile);

  return pid;
}

function startedPorts(): string[] {
  return fs.existsSync(DIRS.pids)
    ? fs.readdirSync(DIRS.pids).map((file) => file.replace(".pid", ""))
    : [];
}

function devStop([port = ""]: string[]): void {
  const pidFile = path.join(DIRS.pids, `${port}.pid`);

  if (!fs.existsSync(pidFile)) {
    const started = startedPorts().join(", ");

    fail(
      `No server this script started on port ${port}. Started ports: ${started === "" ? "none" : started}`
    );
  }

  out({ port: Number(port), stopped: stopPid(pidFile) });
}

function alive(pid: number): boolean {
  try {
    process.kill(-pid, 0);

    return true;
  } catch {
    return false;
  }
}

/** Waits for stopped servers to exit, so they don't write into a dir being deleted. */
async function waitGone(pids: number[], deadline: number): Promise<void> {
  if (!pids.some(alive) || Date.now() > deadline) {
    return;
  }

  await sleep(200);
  await waitGone(pids, deadline);
}

async function cleanup(args: string[]): Promise<void> {
  const dryRun = args.includes("--dry-run");
  const ports = startedPorts();
  const scratchDirs = fs.existsSync(DIRS.scratch)
    ? fs.readdirSync(DIRS.scratch).map((dir) => path.join(DIRS.scratch, dir))
    : [];

  if (!dryRun) {
    const pids = ports.map((port) =>
      stopPid(path.join(DIRS.pids, `${port}.pid`))
    );

    await waitGone(pids, Date.now() + 10_000);

    for (const dir of scratchDirs) {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  }

  const evidence = fs.existsSync(DIRS.evidence)
    ? fs.readdirSync(DIRS.evidence).length
    : 0;

  out({
    dryRun,
    evidenceKept: { dir: DIRS.evidence, files: evidence },
    removedScratch: scratchDirs,
    stoppedPorts: ports,
  });
}

type Command = (args: string[]) => Promise<void> | void;

const devCommands = new Map<string, Command>([
  ["fetch", devFetch],
  ["start", devStart],
  ["stop", devStop],
]);

async function dev([sub = "", ...rest]: string[]): Promise<void> {
  const handler = devCommands.get(sub);

  if (handler === undefined) {
    fail('Use "dev start <dir>", "dev fetch <url>" or "dev stop <port>".');
  }

  await handler(rest);
}

const commands = new Map<string, Command>([
  ["cleanup", cleanup],
  ["dev", dev],
  ["doctor", doctor],
  ["run", run],
  ["scratch", scratch],
]);

const [command = "--help", ...rest] = process.argv.slice(2);
const handler = commands.get(command);

if (command === "--help" || command === "-h") {
  process.stdout.write(`${HELP}\n`);
} else if (handler === undefined) {
  fail(`Unknown command "${command}". Run with --help.`);
} else {
  await handler(rest);
}
