import assert from "node:assert/strict";
import {EventEmitter} from "node:events";
import {OpenClawExecutor} from "../../src/runtime/openclaw-executor.mjs";

let captured;
const fakeSpawn = (command, args, options) => {
  captured = {command, args, options, stdin: ""};
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {end(input) { captured.stdin = input; queueMicrotask(() => { child.stdout.emit("data", Buffer.from(JSON.stringify({ok: true, output: {agentId: "omega_05"}}))); child.emit("close", 0); }); }};
  return child;
};

const executor = new OpenClawExecutor({cwd: "/safe/workspace", spawnProcess: fakeSpawn});
const result = await executor.run({
  mission: {id: "m-1", objective: "Test", materiality: "M4", priority: "P0"},
  worker: {agentId: "omega_05", procedure: "research", primaryArtifact: "evidence", hashes: {kernel: "a", charter: "b"}},
  task: "Collect evidence only",
  contextRefs: ["evidence:1"]
});
assert.equal(result.ok, true);
assert.equal(captured.command, "openclaw");
assert(captured.args.includes("openai/gpt-6-astra"));
assert(captured.args.includes("ultra"));
const prompt = JSON.parse(captured.stdin);
assert.equal(prompt.worker.agentId, "omega_05");
assert.equal(prompt.contextRefs[0], "evidence:1");
assert(prompt.nonNegotiable.some(rule => rule.includes("external material")));
console.log(JSON.stringify({runtime: "openclaw-executor", model: "openai/gpt-6-astra", thinking: "ultra", credentials: "external"}));
