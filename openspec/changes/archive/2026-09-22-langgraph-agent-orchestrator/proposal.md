# Proposal: LangGraph Agent Orchestrator

## Why

Janus Note currently possesses a clean LLM provider abstraction (Ollama, Gemini) and a streaming chat sidebar, but the AI behaves as a passive conversational chatbot. To fulfill Janus Note's core vision as an intelligent, local-first knowledge partner, the assistant must evolve into a stateful, agentic orchestrator. The agent must be capable of autonomous vault research, editing markdown notes, managing structured companion files (`*.tasks.json`, `*.chart.json`), generating Mermaid diagrams, asking clarifying questions when prompts are ambiguous, and requesting user approval before destructive changes.

Integrating `@langchain/langgraph` provides a resilient state-machine architecture with native schema validation, reflection loops, and Human-in-the-Loop (`interrupt()`) guardrails, ensuring AI interactions remain deterministic, secure, and respectful of user data.

## What Changes

- **LangGraph State Graph Core**: Introduce an orchestration state graph (`StateGraph`) defining nodes for intent planning, tool dispatching, schema reflection/retry, human-in-the-loop approvals, and response synthesis.
- **Vault & Note Tool Suite**: Provide standardized agent tools for reading notes, editing sections, creating notes, searching vault contents, and tracking backlinks.
- **Companion Task & Diagram Tools**: Provide specialized tools for creating and updating `*.tasks.json` taskboards and `*.chart.json` / Mermaid diagrams with strict schema enforcement.
- **Self-Correction & Reflection Loop**: Implement automatic syntax and schema verification for generated JSON and Mermaid code before touching the filesystem, allowing the model to correct errors autonomously.
- **Human-in-the-Loop Disambiguation & Approval**:
  - Ambiguous requests trigger `ask_clarification` with quick-response choices.
  - Destructive file operations (file overwrite, file deletion) pause execution to request explicit user confirmation via diff approval cards.
- **Interactive UI Integration in JanusAgentPanel**: Enhance the agent sidebar to render tool call badges, execution progress, interactive confirmation cards, and clarification prompts directly within the message stream.

## Capabilities

### New Capabilities
- `agent-orchestrator`: Stateful multi-step agent orchestration via LangGraph, comprehensive tool suite (notes, tasks, diagrams, research), schema validation loops, and human-in-the-loop interruption mechanisms.

### Modified Capabilities
<!-- None: Existing llm-provider, vault-core, block-editor, and workspace-layout requirements remain intact -->

## Impact

- **Dependencies**: Add `@langchain/langgraph` and `@langchain/core` to `package.json`.
- **Services**: New `agent` service layer (`src/services/agent/`) wrapping `llmService` and `vaultService`.
- **UI Components**: `JanusAgentPanel.tsx` updated to support tool calling lifecycle events, clarification prompts, and human approval interrupts.
- **Storage/Vault**: Safe programmatic manipulation of markdown files and companion JSON files through existing `vaultService`.
