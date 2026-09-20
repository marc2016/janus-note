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

### Requirement: Interactive Folder Creation in File Explorer
The system SHALL provide an inline folder creation form in the File Explorer panel matching the styling, input controls, and interactions of the note creation form, allowing users to create folders and arbitrarily nested subfolders.

#### Scenario: Opening folder creation form
- **WHEN** user clicks the "New Folder" action in the File Explorer header
- **THEN** system renders an inline input form matching the note creation form with an autofocus text input, Cancel button, and Create button

#### Scenario: Submitting folder creation
- **WHEN** user enters a folder name (e.g. `archive` or `docs/architecture`) and submits via Enter or the Create button
- **THEN** system creates the directory in the Vault, closes the form, refreshes the file tree, and displays the folder hierarchy

#### Scenario: Creating deep directories using slash notation
- **WHEN** user enters a slash-separated path (e.g. `projects/janus/specs`) in the folder creation input
- **THEN** system creates the full directory hierarchy and displays the nested structure in the tree

#### Scenario: Cancelling folder creation
- **WHEN** user presses Escape or clicks Cancel in the inline folder form
- **THEN** system closes the inline form without creating a directory or altering tree state

### Requirement: Drag-and-Drop Tree Organization
The system SHALL enable users to drag and drop single or multiple selected files and folders within the File Explorer tree to relocate them into target folders or to the Vault root, providing visual drop feedback and updating open editor tabs.

#### Scenario: Dragging a file onto a folder
- **WHEN** user drags a file node and drops it over a folder node in the File Explorer
- **THEN** system moves the file into that folder, refreshes the tree hierarchy, and keeps the target folder expanded

#### Scenario: Dragging a folder into another folder
- **WHEN** user drags a folder node and drops it over a different destination folder
- **THEN** system moves the source folder into the destination folder and updates the tree display

#### Scenario: Dragging multiple selected items into a folder
- **WHEN** user selects multiple files and folders and drags any one of them onto a destination folder
- **THEN** system moves all selected items into the destination folder and updates the tree

#### Scenario: Dragging items to the Vault root
- **WHEN** user drags one or multiple selected files or folders and drops them onto the explorer background or root drop zone
- **THEN** system moves all dragged items to the Vault root level and refreshes the tree

#### Scenario: Visual drop target feedback and count indicator
- **WHEN** user drags single or multiple items over a valid destination folder or root zone
- **THEN** system highlights the drop target with visual styling and displays the dragged item count if multiple items are selected

#### Scenario: Disallowing drop onto self or descendant
- **WHEN** user drags a selection containing a folder over that folder itself or over any of its descendant subfolders
- **THEN** system disallows the drop, displays no valid target styling, and rejects the action

#### Scenario: Disallowing drop into same parent
- **WHEN** user drops an item onto its current parent directory
- **THEN** system treats the action as a no-op without invoking filesystem changes

#### Scenario: Updating open editor tabs when files are moved
- **WHEN** open notes (or notes inside moved folders) are relocated to a new destination
- **THEN** system updates each affected tab's path and preserves active editor state and content

### Requirement: Multi-Selection in File Explorer
The system SHALL support selecting multiple files and directories in the File Explorer tree using standard desktop keyboard modifiers.

#### Scenario: Toggling selection with Command/Control key
- **WHEN** user clicks a node while holding the Cmd key (macOS) or Ctrl key (Windows/Linux)
- **THEN** system toggles the selection state of that node without deselecting already selected nodes

#### Scenario: Range selection with Shift key
- **WHEN** user clicks a node while holding the Shift key after having selected an initial node
- **THEN** system selects all visible nodes in the tree between the anchor node and the clicked node

#### Scenario: Single selection on plain click
- **WHEN** user clicks a node without modifier keys
- **THEN** system selects that node exclusively, clears all other selections, and opens the file if it is a note
