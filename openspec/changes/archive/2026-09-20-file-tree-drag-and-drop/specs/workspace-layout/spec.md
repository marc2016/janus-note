# Spec Delta: workspace-layout

## ADDED Requirements

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
