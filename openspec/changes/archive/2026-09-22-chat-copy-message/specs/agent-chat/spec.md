# Spec Delta

## Purpose

Enables an interactive desktop chat interface for interacting with the Janus AI assistant, displaying conversational turn history, tool execution badges, clarification options, approval diffs, and message actions such as clipboard copying.

## ADDED Requirements

### Requirement: Copy Individual Chat Messages to Clipboard
The system SHALL provide an interactive copy button on every individual message (both user messages and agent responses) within the agent chat panel that copies the message's text content to the system clipboard upon activation.

#### Scenario: Copying an agent message
- **WHEN** the user clicks the copy button on an agent message
- **THEN** the system writes the full text of that agent message to the clipboard without including external metadata or UI wrappers.

#### Scenario: Copying a user prompt
- **WHEN** the user clicks the copy button on a user message
- **THEN** the system writes the full text of that user prompt to the clipboard.

#### Scenario: Visual confirmation feedback
- **WHEN** a message is successfully copied to the clipboard
- **THEN** the copy button visually switches to a confirmed state (such as a checkmark icon with a "Kopiert!" tooltip or indicator) for a brief duration (approximately 2 seconds) before reverting to its initial state.

#### Scenario: Fallback on clipboard failure
- **WHEN** the modern asynchronous Clipboard API (`navigator.clipboard.writeText`) is blocked or unavailable
- **THEN** the system attempts a fallback copy mechanism or displays a non-destructive failure indication without crashing the application.
