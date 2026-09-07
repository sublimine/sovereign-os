# Seguridad, Compartimentación y Prompt-Injection Resilience

## 1. Zero trust

Agent name grants nothing. Every operation requires identity, signed charter
hash, mission, lease, action/object, tool parameters, data class, compartment,
effect, expiry and approvals. Policy is evaluated immediately before effect.

## 2. Trust zones

`RAW_UNTRUSTED`, `QUARANTINED`, `SANITIZED_DATA`, `MISSION_INTERNAL`,
`COMPARTMENTED`, `SEALED_SOURCE_IDENTITY`, `RELEASED_PRODUCT`. Moving between
zones requires artifact and gate; copy/paste is not transition.

## 3. External content firewall

Store raw inert; hash; metadata; safe parser; strip active content; detect
instruction-like material; label DATA spans; model sees quoted payload via
constrained adapter; tools unavailable to untrusted content; output validated.
Injection evidence remains preserved for Σ30/Ω14.

## 4. Secrets

SecretBroker provides scoped handle, not value, when possible. No secrets in
prompts/logs/artifact titles. Egress rules prevent inference through broad
summaries. Human source identity uses pseudonymous ref; authorized auditor can
resolve through separate key domain.

## 5. Sandboxes

Network allowlist, read-only inputs, ephemeral filesystem, resource caps,
blocked subprocess/effect by default, deterministic clock/random seed where
needed, output scan and audit. Collection providers cannot grant themselves a
new domain or credential.

## 6. Human approval

Mandatory for new sensitive source contact, payment/contract, representation,
restricted data, nonstandard surveillance, dangerous code/effect, constitutional
waiver, P0 residual risk and production deployment. Approval states exactly
what is authorized; it does not certify facts.

