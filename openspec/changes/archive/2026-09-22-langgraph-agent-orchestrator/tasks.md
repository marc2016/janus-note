# Tasks: LangGraph Agent Orchestrator

## 1. Dependencies & Model Adapter

- [x] 1.1 Install `@langchain/langgraph` and `@langchain/core` as dependencies and verify clean build with `npm run build`
- [x] 1.2 Implement `JanusChatModel` bridging LangChain's `BaseChatModel` to `llmService.chatStream()` and verify message mapping via unit tests

## 2. Agent Tool Suite

- [x] 2.1 Implement Vault & Note tools (`read_note`, `create_note`, `edit_note`, `search_vault`, `list_vault_files`) in `src/services/agent/tools/noteTools.ts` and verify unit tests against `vaultService`
- [x] 2.2 Implement Companion Task tools (`create_task_list`, `add_tasks`, `update_task`, `get_task_list`) in `src/services/agent/tools/taskTools.ts` and verify with JSON schema validation tests
- [x] 2.3 Implement Diagram & Mermaid tools (`create_chart_companion`, `insert_mermaid_diagram`, `update_diagram`, `validate_diagram_syntax`) in `src/services/agent/tools/diagramTools.ts` and verify syntax validation tests
- [x] 2.4 Implement Concept & Research tools (`find_related_notes`, `get_note_backlinks`, `extract_key_concepts`, `synthesize_summary`) in `src/services/agent/tools/researchTools.ts` and verify search aggregation tests

## 3. LangGraph State Machine & Guardrails

- [x] 3.1 Define `AgentState` and construct the LangGraph StateGraph in `src/services/agent/agentGraph.ts` with planning, tool execution, and response synthesis nodes
- [x] 3.2 Implement schema reflection loop that catches malformed companion JSON / invalid Mermaid syntax and retries up to 2 times before failing gracefully
- [x] 3.3 Implement Human-in-the-Loop `interrupt()` checkpoints for `ask_clarification` and `request_file_approval` with state resumption handlers

## 4. UI Integration in JanusAgentPanel

- [x] 4.1 Update `src/components/sidebar/JanusAgentPanel.tsx` to display real-time tool execution progress badges and status indicators
- [x] 4.2 Implement interactive Clarification Prompt and Diff Approval Card components in the agent chat with "Genehmigen" / "Ablehnen" actions
- [x] 4.3 Run full test suite with `npm run test` and verify that the complete agent flow functions properly in both Tauri and browser environments
