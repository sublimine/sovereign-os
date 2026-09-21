// Trusted supervisor stdout has two control frames. Program bytes are returned
// only after the nonce-bound post-exec frame; they are never parsed as control.
import {check, clone, keys} from '../lib/contracts.mjs';

const MAX_FRAME_BYTES = 16384;
const gate = (ok, message) => check(ok, 'EXECUTION_GATE', message);
export class ExecutionLaunchProtocol {
  #nonce; #snapshotHash; #ready = null; #started = null; #released = false;
  #buffer = Buffer.alloc(0); #failed = false;
  constructor({nonce, snapshotHash}) { this.#nonce = nonce; this.#snapshotHash = snapshotHash; }
  get ready() { return this.#ready && clone(this.#ready); }
  get started() { return this.#started && clone(this.#started); }
  get released() { return this.#released; }
  release() {
    gate(!this.#failed && this.#ready && !this.#released, 'Execution release requires one valid ready frame');
    this.#released = true;
  }
  feed(chunk) {
    try {
      gate(!this.#failed && Buffer.isBuffer(chunk), 'Invalid or failed execution control stream');
      if (this.#started) return Buffer.from(chunk);
      if (!chunk.length) return Buffer.alloc(0);
      gate(!this.#ready || this.#released, 'Output before controller release');
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      const newline = this.#buffer.indexOf(10);
      gate((newline < 0 ? this.#buffer.length : newline + 1) <= MAX_FRAME_BYTES, 'Execution control frame exceeds cap');
      if (newline < 0) return Buffer.alloc(0);
      let frame;
      try { frame = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(this.#buffer.subarray(0, newline))); }
      catch { gate(false, 'Invalid execution control frame'); }
      gate(frame?.nonce === this.#nonce && frame?.snapshotHash === this.#snapshotHash,
        'Execution control frame changed nonce or snapshot');
      const tail = this.#buffer.subarray(newline + 1); this.#buffer = Buffer.alloc(0);
      if (!this.#ready) {
        keys(frame, ['kind', 'nonce', 'snapshotHash', 'namespaces', 'noNewPrivileges', 'effectiveCapabilities', 'seccomp']);
        gate(frame.kind === 'sovereign.execution.ready.v1' && frame.noNewPrivileges === true
          && frame.seccomp === true && frame.effectiveCapabilities === '0'
          && frame.namespaces && typeof frame.namespaces === 'object' && !Array.isArray(frame.namespaces),
        'Bootstrap did not attest the exact ready state');
        gate(tail.length === 0, 'Output before controller release');
        this.#ready = clone(frame); return Buffer.alloc(0);
      }
      keys(frame, ['kind', 'nonce', 'snapshotHash', 'pid']);
      gate(frame.kind === 'sovereign.execution.started.v1' && Number.isSafeInteger(frame.pid) && frame.pid > 0,
        'Bootstrap did not confirm the requested program exec');
      this.#started = clone(frame); return Buffer.from(tail);
    } catch (error) {
      this.#failed = true;
      if (error.code === 'EXECUTION_GATE') throw error;
      gate(false, 'Invalid execution control frame fields');
    }
  }
}
