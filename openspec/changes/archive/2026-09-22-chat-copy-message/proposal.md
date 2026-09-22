# Proposal: Copy Individual Chat Messages to Clipboard

## Why

In the Janus Agent interaction panel, users frequently exchange prompts, generated code, structured lists, summaries, and notes with the AI. Currently, there is no direct mechanism to copy an individual message's text (neither user prompts nor agent responses) to the clipboard without manually highlighting and selecting the text with the mouse. Adding a one-click copy button to every message bubble improves ergonomics and enables frictionless transfer of prompts and AI responses into notes, terminal commands, or external tools.

## What Changes

- **Message Copy Action**: Introduce a copy button on both user and agent message bubbles in `JanusAgentPanel`.
- **Clipboard Integration**: Use `navigator.clipboard.writeText` with a robust fallback to write the full raw text content of the message into the system clipboard.
- **Visual Feedback**: Provide immediate confirmation on click (e.g., transition from `Copy` icon to `Check` icon and "Kopiert!" tooltip/state for 2 seconds).
- **Clean Hover & Accessibility Design**: Display the copy button cleanly upon hovering over message bubbles (and keep it accessible via focus and touch) without cluttering the compact chat interface.

## Capabilities

### New Capabilities

- `agent-chat`: Defines the interactive chat interface behavior in the agent sidebar, including conversational message rendering, message interactions (such as copying individual message text to the clipboard with visual confirmation), and error handling.

### Modified Capabilities

*(None)*

## Impact

- **UI Components**: `src/components/sidebar/JanusAgentPanel.tsx` receives the copy interaction, icons (`Copy`, `Check` from `lucide-react`), and feedback state.
- **Dependencies**: Uses existing `lucide-react` icons and standard browser Clipboard API.
- **Tests**: Add unit and integration tests validating message copy actions, clipboard calls, and confirmation states.
