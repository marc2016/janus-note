# agent-orchestrator Specification

## Purpose

Enables an autonomous, stateful agent workflow powered by LangGraph to research vault notes, edit markdown documents, manage structured task and diagram companions, and safely involve the user through reflection loops and human-in-the-loop approvals.

## Requirements

### Requirement: LangGraph State Machine Execution
The system SHALL orchestrate agent actions through a state graph managing intent resolution, tool dispatching, schema reflection loops, and human-in-the-loop interruption checkpoints.

#### Scenario: Multi-turn stateful execution
- **WHEN** a user submits a multi-step prompt (such as researching notes, drafting a concept, and creating tasks)
- **THEN** the state graph transitions between planning, tool invocation, and synthesis nodes while preserving message history and intermediate tool outputs in state.

#### Scenario: Provider delegation
- **WHEN** the agent graph invokes an LLM generation node
- **THEN** requests are routed through the configured `LlmService` provider with standardized tool declarations and streaming tokens.

### Requirement: Vault File and Content Tools
The system SHALL provide deterministic tools for the agent to inspect, search, create, and modify markdown notes inside the active vault.

#### Scenario: Reading and searching notes
- **WHEN** the agent needs context on a topic
- **THEN** it invokes `search_vault` or `read_note` to retrieve exact file contents and metadata without modifying disk state.

#### Scenario: Section-targeted note editing
- **WHEN** the agent updates an existing markdown note
- **THEN** it performs targeted edits (appending, replacing sections, or applying patches) without corrupting unrelated document content.

### Requirement: Structured Companion Data Management
The system SHALL provide specialized tools to inspect, create, and update structured `*.tasks.json` and `*.chart.json` companion files and embed corresponding markdown blocks into notes.

#### Scenario: Creating task companion files
- **WHEN** the user instructs the agent to create a task list
- **THEN** the agent writes a strictly validated `*.tasks.json` file with title, status, priority, and task items, and inserts the ` ```tasks ` reference block into the specified note.

#### Scenario: Modifying task items
- **WHEN** the user asks to mark a task done or add new items
- **THEN** the agent loads the existing `*.tasks.json`, applies the requested item changes, and writes back the updated JSON preserving existing IDs and attributes.

#### Scenario: Generating diagrams and charts
- **WHEN** the user asks to visualize architecture, workflows, or mindmaps
- **THEN** the agent produces either a companion `*.chart.json` or an inline Mermaid code block adhering to correct diagram specifications.

### Requirement: Autonomous Reflection and Schema Validation Loop
The system SHALL validate generated companion JSON payloads and diagram syntax in a self-correction loop before writing them to the vault filesystem.

#### Scenario: Schema validation retry
- **WHEN** an LLM output emits malformed JSON or an invalid companion schema
- **THEN** the graph routes the validation error back to the model in a reflection node, requesting corrected output up to a maximum retry limit before failing gracefully.

#### Scenario: Mermaid syntax validation
- **WHEN** an inline Mermaid diagram is generated
- **THEN** the validator checks syntax correctness and prompts model re-generation if parsing fails.

### Requirement: Human-in-the-Loop Clarification and Approval Interruption
The system SHALL interrupt state graph execution to solicit user input whenever intent is ambiguous or when a proposed file operation is destructive.

#### Scenario: Clarification on ambiguous intent
- **WHEN** the user's prompt lacks critical parameters (such as diagram style or destination note)
- **THEN** the agent invokes `ask_clarification`, pausing graph execution and presenting a structured prompt with selectable quick-reply options in the chat interface.

#### Scenario: Approval for destructive file modifications
- **WHEN** a tool proposes overwriting an existing file or deleting content
- **THEN** the agent pauses execution via `interrupt()`, displays a diff preview card in the agent panel, and only applies changes to disk upon explicit user confirmation.

#### Scenario: Rejection of proposed changes
- **WHEN** the user rejects a proposed file operation
- **THEN** the graph resumes with rejection feedback, allowing the model to propose an alternative or cleanly abort the action without altering vault files.
