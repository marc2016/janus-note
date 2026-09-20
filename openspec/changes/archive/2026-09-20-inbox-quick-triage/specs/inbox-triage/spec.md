# Spec Delta: inbox-triage

## Purpose

Provides a zero-friction quick-capture inbox note protected from deletion, top-level navigation, and a structured triage workflow to sort thoughts into new or existing Vault files and folders.

## ADDED Requirements

### Requirement: Permanent Protected Inbox Note Provisioning
The system SHALL ensure a permanent `Inbox.md` file exists in the active Vault root, creating it automatically with initial welcome and guidance content if absent, and prohibiting its deletion or renaming across the frontend and backend.

#### Scenario: Opening a vault without an inbox
- **WHEN** user selects or opens a Vault directory that does not contain an `Inbox.md` file
- **THEN** system automatically creates `Inbox.md` at the Vault root with helpful quick-capture guidance comments

#### Scenario: Opening a vault with existing inbox
- **WHEN** user opens a Vault directory that already contains `Inbox.md`
- **THEN** system retains the existing `Inbox.md` file without overwriting its contents

#### Scenario: Attempting to delete or rename inbox file
- **WHEN** user or process attempts to delete or rename `Inbox.md` via the file explorer context menu or backend file operation
- **THEN** system rejects the action with a clear error indicating that the Inbox is a protected system document

### Requirement: Pinned Inbox Quick Navigation
The system SHALL display a prominent, pinned Inbox shortcut at the top of the File Explorer sidebar, providing instant one-click access and active state indication.

#### Scenario: Clicking pinned inbox item
- **WHEN** user clicks the pinned Inbox item in the File Explorer sidebar
- **THEN** system opens `Inbox.md` in the active editor tab (or focuses the tab if already open) and highlights the pinned item

#### Scenario: Keyboard shortcut for quick inbox capture
- **WHEN** user presses the quick-capture shortcut (`Cmd+Shift+I` / `Ctrl+Shift+I`)
- **THEN** system opens `Inbox.md` immediately, sets editor focus, and places the cursor at the end of the document for typing

### Requirement: Interactive Content Triage and Relocation
The system SHALL provide a Triage action when viewing `Inbox.md` that enables users to relocate entire notes or selected text blocks into an existing target note or a newly specified folder/note path.

#### Scenario: Triggering triage on selected text
- **WHEN** user selects a block of text in `Inbox.md` and clicks the "Triage" button (or shortcut `Cmd+Shift+T`)
- **THEN** system opens the Triage modal displaying the selected snippet and target destination options

#### Scenario: Triggering triage without selection
- **WHEN** user clicks "Triage" with no text selected in `Inbox.md`
- **THEN** system opens the Triage modal targeting the entire content of `Inbox.md`

#### Scenario: Filing into an existing note
- **WHEN** user selects an existing note in the Triage modal and confirms
- **THEN** system appends the triaged snippet to the target note, removes the snippet from `Inbox.md`, saves both files atomically, and displays a success notification

#### Scenario: Filing into a new note and nested folder path
- **WHEN** user specifies a new path (e.g. `ideas/startup/pitch.md`) in the Triage modal and confirms
- **THEN** system creates any missing parent directories, writes the new markdown file with the triaged snippet, removes it from `Inbox.md`, and updates the file tree

#### Scenario: Editor action banner and Einsortieren button
- **WHEN** user opens or focuses `Inbox.md` in the editor
- **THEN** system displays a prominent Inbox action banner below the editor toolbar with an "Einsortieren" button (and shortcut hint `⌘⇧T`), providing a highly discoverable entry point for users unfamiliar with the hotkey

#### Scenario: Immediate in-editor content refresh after triage
- **WHEN** user confirms a triage relocation from `Inbox.md`
- **THEN** system immediately updates and reloads the active editor buffer to reflect the removed snippet without requiring the user to switch tabs or reload the note

#### Scenario: Cancelling triage
- **WHEN** user dismisses or cancels the Triage modal
- **THEN** system closes the modal without modifying `Inbox.md` or any other file

### Requirement: AI Triage Structured Payload Readiness
The system SHALL prepare and expose a structured triage payload containing the pending inbox text and a serialized tree of vault paths, enabling AI agents to recommend destination files and folder classifications.

#### Scenario: Generating AI triage context
- **WHEN** the triage assistant is invoked for the Inbox
- **THEN** system compiles the inbox content together with existing directory names and note titles into a structured payload for LLM analysis
