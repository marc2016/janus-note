# Spec Delta: workspace-layout

## ADDED Requirements

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
