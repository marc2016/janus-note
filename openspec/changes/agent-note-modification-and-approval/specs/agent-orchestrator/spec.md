# Spec Delta: Agent Orchestrator

## MODIFIED Requirements

### Requirement: Vault File and Content Tools
The system SHALL provide deterministic tools for the agent to inspect, search, create, and modify markdown notes inside the active vault.

#### Scenario: Reading and searching notes
- **WHEN** the agent needs context on a topic
- **THEN** it invokes `search_vault` or `read_note` to retrieve exact file contents and metadata without modifying disk state.

#### Scenario: Section-targeted note editing
- **WHEN** the agent updates an existing markdown note
- **THEN** it performs targeted edits (appending, replacing sections, or applying patches) without corrupting unrelated document content.

#### Scenario: In-place text replacement
- **WHEN** the agent needs to replace or rephrase a specific text passage or selection within a note
- **THEN** it invokes `search_and_replace_note` with the target substring and replacement text, ensuring only the intended snippet is modified.

### Requirement: Human-in-the-Loop Clarification and Approval Interruption
The system SHALL interrupt state graph execution to solicit user input whenever intent is ambiguous or when a proposed file operation is destructive.

#### Scenario: Clarification on ambiguous intent
- **WHEN** the user's prompt lacks critical parameters (such as diagram style or destination note)
- **THEN** the agent invokes `ask_clarification`, pausing graph execution and presenting a structured prompt with selectable quick-reply options in the chat interface.

#### Scenario: Clarification on editing mode
- **WHEN** the user's editing prompt is ambiguous between replacing existing content or appending to the note
- **THEN** the agent pauses execution via `ask_clarification` offering choices to replace, patch sections, or append.

#### Scenario: Approval for destructive file modifications
- **WHEN** a tool proposes overwriting an existing file or deleting content
- **THEN** the agent pauses execution via `interrupt()`, displays a diff preview card in the agent panel, and only applies changes to disk upon explicit user confirmation.

#### Scenario: Approval for in-place text replacement or section patching
- **WHEN** a tool proposes replacing a section, searching and replacing text, or replacing file content
- **THEN** the agent halts execution with `pendingApproval`, renders a colored diff preview (added vs. removed lines), and applies the write only upon user confirmation.

#### Scenario: Rejection of proposed changes
- **WHEN** the user rejects a proposed file operation
- **THEN** the graph resumes with rejection feedback, allowing the model to propose an alternative or cleanly abort the action without altering vault files.

## ADDED Requirements

### Requirement: Active Document and Selection Context Injection
The system SHALL provide the agent with the active note's full text content and any active text selection from the editor to ground user requests in current document state.

#### Scenario: Active note content context
- **WHEN** the user interacts with the agent while a note is open in the editor
- **THEN** the prompt sent to the agent graph includes the active note title, relative path, and current document content.

#### Scenario: Editor text selection context
- **WHEN** the user has highlighted a passage of text in the editor before sending an agent query
- **THEN** the prompt includes the highlighted text as explicit selection context and the agent interface displays a selection indicator badge.
