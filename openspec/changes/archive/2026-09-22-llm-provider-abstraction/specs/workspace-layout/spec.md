# Spec Delta: workspace-layout

## ADDED Requirements

### Requirement: Pinned AI Configuration Navigation in Sidebar
The system SHALL provide a pinned navigation item for AI Configuration in the primary File Explorer sidebar, positioned adjacent to the pinned Inbox item.

#### Scenario: Navigating to AI Configuration
- **WHEN** the user clicks the pinned AI Configuration button in the left sidebar
- **THEN** the workspace opens or focuses the AI Configuration view in the center canvas.

#### Scenario: Visual active state in sidebar
- **WHEN** the AI Configuration view is currently focused in the center canvas
- **THEN** the pinned AI Configuration sidebar item displays an active indicator matching the theme styling.

### Requirement: Virtual Settings Tabs in Workspace Shell
The system SHALL support opening dedicated non-note virtual tabs in the center canvas, rendering configuration views instead of the Markdown block editor.

#### Scenario: Opening AI Configuration virtual tab
- **WHEN** the AI Configuration view is activated
- **THEN** the center TabBar displays a tab for AI Configuration (`virtual:ai-config`) and the center panel renders the interactive AI Configuration form.

#### Scenario: Switching between notes and AI Configuration tab
- **WHEN** the user switches between an open note tab and the AI Configuration tab
- **THEN** the center canvas transitions between the Markdown editor and the AI Configuration view while preserving dirty state and cursor context in note tabs.

#### Scenario: Closing the AI Configuration tab
- **WHEN** the user closes the AI Configuration tab
- **THEN** the tab is removed from the TabBar and the center canvas activates the previously focused note or empty state.
