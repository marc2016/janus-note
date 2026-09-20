# Spec Delta: vault-core

## ADDED Requirements

### Requirement: Vault Path Relocation and Renaming
The system SHALL support moving and relocating single and multiple files and directories within the active Vault root, strictly validating path containment, checking collisions, and preventing circular hierarchy moves.

#### Scenario: Moving a file to a destination folder
- **WHEN** client requests moving a file from `notes/todo.md` into directory `archive`
- **THEN** system moves the file on disk to `archive/todo.md` within the active Vault

#### Scenario: Moving a folder into another directory
- **WHEN** client requests moving folder `projects/web` into directory `archive`
- **THEN** system moves the folder and all its contents to `archive/web` within the active Vault

#### Scenario: Moving multiple items simultaneously
- **WHEN** client requests batch moving `["notes/a.md", "notes/b.md", "assets/logo.png"]` into destination folder `docs`
- **THEN** system moves each selected item into `docs/` and reports the successful relocations

#### Scenario: Moving items to the Vault root
- **WHEN** client requests moving nested items `docs/guide.md` and `docs/specs` to root destination `""`
- **THEN** system relocates the items to the top-level Vault directory

#### Scenario: Preventing circular directory moves
- **WHEN** client requests moving a folder into itself (e.g. `folder-a` to `folder-a/nested`) or into any of its own subdirectories
- **THEN** system rejects the operation with an error and leaves the filesystem unchanged

#### Scenario: Blocking moves escaping vault boundaries
- **WHEN** client requests moving a path with directory traversal components (`../`) or targeting outside the active Vault
- **THEN** system rejects the request with an authorization security error

#### Scenario: Rejecting move when destination already exists
- **WHEN** client requests moving an item to a target path that already exists
- **THEN** system rejects the relocation with a collision error without overwriting the existing destination
