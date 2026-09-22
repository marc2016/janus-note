# Design: LangGraph Agent Orchestrator

## Context

Janus Note features a modular LLM provider layer (`LlmService` supporting Ollama and Gemini with token streaming and tool calling contracts) and a local-first vault storage layer (`vaultService`). To support autonomous research, markdown editing, structured companion file management, diagram generation, and safe human interaction, we introduce an orchestration engine using `@langchain/langgraph`.

## Goals / Non-Goals

**Goals:**
- Implement an explicit state graph (`AgentStateGraph`) using `@langchain/langgraph` that models the lifecycle: `planning` $\rightarrow$ `tools` $\rightarrow$ `validate/reflect` $\rightarrow$ `human_interrupt` $\rightarrow$ `respond`.
- Build a bridge (`JanusChatModel` adapter) extending LangChain's `BaseChatModel` that delegates completions to `LlmService`, avoiding duplicate provider implementations.
- Provide a typed, deterministic tool library covering:
  - Vault & markdown operations (`read_note`, `create_note`, `edit_note`, `search_vault`, `list_vault_files`).
  - Structured task lists (`create_task_list`, `add_tasks`, `update_task`, `get_task_list` for `*.tasks.json`).
  - Diagram management (`create_chart_companion`, `insert_mermaid_diagram`, `update_diagram`, `validate_diagram_syntax`).
  - Research & concept synthesis (`find_related_notes`, `get_note_backlinks`, `extract_key_concepts`, `synthesize_summary`).
  - Human-in-the-Loop disambiguation & approval (`ask_clarification`, `request_file_approval`).
- Implement schema reflection loops where malformed JSON or invalid Mermaid code triggers automatic self-correction up to 2 retries before writing to the vault.
- Update `JanusAgentPanel` to display tool execution badges, interactive clarification buttons, and diff approval cards for interrupted states.

**Non-Goals:**
- Heavy local vector database (Chroma/FAISS) or embedding pipeline: in this release, research uses fast, privacy-preserving lexical and keyword search across vault notes.
- Automatic git commits or external git pushing (respecting strict user guardrails).

## Decisions

### 1. LangGraph StateGraph Architecture
**Choice**: Use `@langchain/langgraph` with a single unified `AgentState`:
```typescript
export interface AgentState {
  messages: BaseMessage[];
  currentGoal?: string;
  activeTools: string[];
  pendingApproval?: {
    toolCallId: string;
    action: 'overwrite' | 'delete' | 'create';
    path: string;
    diff?: string;
    proposedContent: string;
  };
  clarification?: {
    toolCallId: string;
    question: string;
    options?: string[];
  };
  validationErrors: string[];
  iterationCount: number;
}
```
**Rationale**: Centralizing messages and pending human checkpoints in the graph state enables pause-and-resume workflows where UI actions directly feed into the resumption payload.

### 2. Custom `JanusChatModel` Adapter
**Choice**: Create a custom LangChain `BaseChatModel` subclass wrapping `LlmService`.
**Rationale**: Avoids re-implementing Ollama / Gemini API clients, auth management, or proxy settings within LangChain. All requests flow through `llmService.chatStream()`, honoring user configuration in `AiConfigView`.

### 3. Reflection Node for Companion & Diagram Validation
**Choice**: Explicit `validate_output` node positioned between tool generation and file write.
**Rationale**: LLMs occasionally output trailing commas or slight structural mismatches in JSON companion files. Catching this in a reflection node and sending the validator error back to the model prevents corrupting `*.tasks.json` or `*.chart.json` files on disk.

### 4. Human-in-the-Loop Interruption Flow
**Choice**: Use LangGraph `interrupt()` when entering `clarification_node` or `approval_node`.
**Rationale**: The graph halts execution without losing state. The UI renders the prompt/diff. When the user selects an option or clicks "Genehmigen / Ablehnen", the UI calls `graph.stream(new Command({ resume: response }))`, seamlessly continuing graph execution.

## Risks / Trade-offs

- **[Risk]**: Multi-step graph runs might feel slow to the user without feedback.
  $\rightarrow$ **Mitigation**: Stream state node events to `JanusAgentPanel` so the user sees live status badges (e.g. `🔍 Durchsuche Notizen...`, `🛠 Validiere Diagramm-Syntax...`).
- **[Risk]**: Destructive file operations could overwrite user data accidentally.
  $\rightarrow$ **Mitigation**: Any write to an existing path forces `request_file_approval` with a visual diff preview before calling `vaultService.writeFile`.
- **[Risk]**: Dependency size with `@langchain/langgraph` and `@langchain/core`.
  $\rightarrow$ **Mitigation**: Only import core and langgraph packages without monolithic partner packages (`@langchain/openai`, etc.).

## Migration Plan

1. Install `@langchain/core` and `@langchain/langgraph`.
2. Scaffold `src/services/agent/` with tools, model adapter, and state graph definition.
3. Add unit tests for tool functions and state transitions with mock responses.
4. Integrate graph runner into `JanusAgentPanel.tsx` and verify interactive flow.
