# workspace-layout Specification

## Purpose

Defines the responsive three-column desktop workspace shell encompassing the file explorer sidebar, the primary editor canvas, and the AI agent interaction drawer.

## Requirements

### Requirement: Modular Three-Column Layout Structure
The system SHALL present an application shell comprising three distinct horizontal panels: an extensible left sidebar container, a center editor canvas, and an extensible right sidebar container.

#### Scenario: Default view presentation
- **WHEN** user launches the application with an open Vault
- **THEN** system displays the active left panel (File Explorer by default), the active Note/Editor in the center, and the active right panel (Janus Agent by default)

### Requirement: Extensible Multi-Panel Sidebars
The system SHALL structure both the left and right sidebars as modular containers supporting multiple switchable and registerable panels (e.g. left: File Explorer, Vault Search; right: Janus Agent, Document Outline, Companion Inspector) with an activity bar or tab switcher.

#### Scenario: Switching active panel in sidebar
- **WHEN** user selects a different panel icon/tab in the sidebar activity bar
- **THEN** system switches the active view in that sidebar to the chosen panel while preserving its state

#### Scenario: Registering future panel extensions
- **WHEN** a new feature module registers a panel into the left or right panel registry
- **THEN** system renders the panel icon in the corresponding sidebar activity bar and enables switching to it

### Requirement: Collapsible Sidebars
The system SHALL allow toggling visibility and collapsing both the left and right sidebars independently.

#### Scenario: User collapses left sidebar
- **WHEN** user triggers the left sidebar toggle button or keyboard shortcut
- **THEN** system collapses the left sidebar and expands the center editor area accordingly

#### Scenario: User collapses right sidebar
- **WHEN** user triggers the right sidebar toggle button or keyboard shortcut
- **THEN** system collapses the right sidebar and maximizes workspace for the editor

### Requirement: Directory Tree Navigation
The system SHALL provide a File Explorer panel in the left sidebar displaying the hierarchical folder and file structure of the active Vault and allowing document selection.

#### Scenario: Selecting a document
- **WHEN** user clicks on a markdown file in the file tree
- **THEN** system opens the selected document in an editor tab (or switches to it if already open) and highlights the active file in the tree

### Requirement: Resizable Sidebars
The system SHALL provide draggable divider handles between the left sidebar, the center editor, and the right sidebar allowing the user to resize each sidebar's width dynamically with defined minimum and maximum constraints, and persist the widths across sessions.

#### Scenario: Dragging sidebar resize handle
- **WHEN** user clicks and drags the separator handle adjacent to a sidebar
- **THEN** system adjusts that sidebar's width in real time within the allowed min/max range

#### Scenario: Sidebar width persistence
- **WHEN** user resizes a sidebar and restarts or reloads the application
- **THEN** system restores the previously configured sidebar width

### Requirement: Multi-Tab Document Workspace
The system SHALL support opening multiple notes simultaneously in a center tab bar, allowing switching between tabs, closing tabs, and displaying modified/dirty state indicators.

#### Scenario: Opening multiple notes in tabs
- **WHEN** user opens multiple markdown files from the file explorer
- **THEN** system displays each open file as a distinct tab in the top tab bar of the editor area

#### Scenario: Switching active document tab
- **WHEN** user clicks an inactive tab in the tab bar
- **THEN** system brings that document into the active editor view while preserving cursor and scroll state of background tabs

#### Scenario: Closing an editor tab
- **WHEN** user clicks the close button on an open tab
- **THEN** system removes the tab from the tab bar and displays the next adjacent open tab (or empty state if no tabs remain)

### Requirement: Minimal Window Frame Without Application Menu Bar
The system SHALL display a clean, modern desktop window frame without a traditional application menu bar (e.g. File, Edit, View), utilizing a compact top window header with a drag region (`data-tauri-drag-region`) to maximize vertical editor space.

#### Scenario: Window presentation without classic menu bar
- **WHEN** user launches the desktop application
- **THEN** system renders the interface without a traditional top menu bar, integrating window controls and drag region directly into the top application header

#### Scenario: Window movement via drag region
- **WHEN** user clicks and drags the top header region
- **THEN** system moves the desktop application window smoothly across the screen
