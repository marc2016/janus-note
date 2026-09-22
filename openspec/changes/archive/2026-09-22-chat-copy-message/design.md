# Design: Chat Message Clipboard Copy

## Context

See [proposal.md](proposal.md) for motivation and problem background.

Currently, `src/components/sidebar/JanusAgentPanel.tsx` renders messages from a local `messages: Message[]` state inside a scrollable container. Each message contains `id`, `sender` ('user' | 'agent'), `text`, `timestamp`, and optional execution metadata (`toolBadges`, `clarification`, `pendingApproval`). Message bubbles are styled conditionally:
- User messages: `bg-accent text-white` (aligned right).
- Agent messages: `bg-surface border border-border-subtle text-text-primary` (aligned left).

Users need a quick, reliable way to copy any message's text to their system clipboard.

## Goals / Non-Goals

**Goals:**
- Provide a responsive copy button on every message bubble (both user and agent).
- Copy the exact plain text content of the target message to the clipboard.
- Display instant visual confirmation (`Copy` icon transitions to `Check` icon with "Kopiert!" feedback) for 2 seconds.
- Provide a robust clipboard utility with standard `navigator.clipboard.writeText` and graceful fallback.
- Ensure thorough test coverage with unit tests.

**Non-Goals:**
- Multi-message selection or exporting the entire chat history (out of scope for this change).
- Rich-text / HTML clipboard formatting (copies markdown / raw text directly).

## Decisions

### Decision 1: Button Placement and Hover Reveal
- **Choice**: Position the copy button in the top-right corner of the message bubble container using a `group` container with `opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity`.
- **Rationale**: Keeps the chat stream visually clean and readable while making the button instantly discoverable on mouse hover or keyboard tab focus.
- **Alternatives considered**:
  - Always visible buttons: Adds visual noise to long conversation histories.
  - Context menu on right click: Less discoverable and harder to use on touch devices.

### Decision 2: Resilient Clipboard Execution Helper
- **Choice**: Implement a utility function `copyTextToClipboard(text: string): Promise<boolean>` in `src/utils/clipboard.ts` (or inline helper) that prioritizes `navigator.clipboard.writeText` and falls back to a temporary textarea element with `document.execCommand('copy')` if modern API access is blocked in webviews.
- **Rationale**: Desktop webviews (Tauri/WebKit) or headless test environments can have subtle clipboard permission limitations. A dual-strategy implementation ensures maximum resilience.

### Decision 3: Ephemeral Confirmation State
- **Choice**: Track `copiedMessageId: string | null` in React state. When clicked, set `copiedMessageId` to the message's ID and schedule a `setTimeout` for 2000ms to clear it.
- **Rationale**: Simple, dependency-free, and avoids race conditions if the user rapidly copies multiple messages.

## Risks / Trade-offs

- **[Clipboard Permissions]** In certain secure desktop contexts or un-focused windows, `navigator.clipboard.writeText` may throw a `NotAllowedError`.
  → *Mitigation*: Gracefully catch errors, attempt textarea fallback, and log warning without crashing the UI.
- **[Empty or Pending Messages]** Streaming or initial agent messages may have empty text (`""`).
  → *Mitigation*: Disable or hide the copy button when `msg.text.trim().length === 0`.
