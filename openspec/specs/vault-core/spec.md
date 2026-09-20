# vault-core Specification

## Purpose

Provides secure local-first file system management, atomic read/write access for markdown and companion JSON files, directory scanning, and real-time file event notifications constrained to the active Vault folder.

## Requirements

### Requirement: Vault Directory Selection and Persistence
The system SHALL allow the user to select an existing local directory as their active Vault and persist the selection for subsequent sessions.

#### Scenario: User selects a vault directory
- **WHEN** user chooses a valid local folder through the directory picker
- **THEN** system sets the path as the active Vault root and persists it in local configuration

#### Scenario: Invalid directory selection
- **WHEN** user selects a path that does not exist or lacks read/write permissions
- **THEN** system rejects the selection and displays a descriptive error message without changing the active Vault

### Requirement: Path Sandboxing and Containment
The system SHALL verify that all file read, write, rename, and delete operations target paths strictly contained within the active Vault directory tree.

#### Scenario: Attempted path traversal
- **WHEN** an operation attempts to read or write a path outside the active Vault (e.g. via `../` traversal or absolute paths outside the root)
- **THEN** system blocks the operation with an authorization security error

### Requirement: Atomic File Read and Write
The system SHALL support reading and writing text files (`.md`) and structured JSON files (`.json`) atomically to prevent corruptions during simultaneous or interrupted writes.

#### Scenario: Saving a markdown note
- **WHEN** user or agent saves changes to a markdown document
- **THEN** system writes the content safely and ensures the file on disk reflects the updated text

#### Scenario: Writing companion JSON data
- **WHEN** a companion data file (such as tasks or charts) is created or updated
- **THEN** system parses and validates JSON formatting before atomically writing it to the target path

### Requirement: Real-Time Filesystem Watching
The system SHALL watch the active Vault directory for external modifications, creations, and deletions and emit real-time notifications to the application frontend.

#### Scenario: External file modification
- **WHEN** a file inside the Vault is modified by an external editor or background process
- **THEN** system emits a file change event containing the relative file path and change type

### Requirement: Vault Directory Creation
The system SHALL provide a command to create directories and arbitrarily nested subdirectories within the active Vault root, ensuring all paths remain strictly contained within the Vault.

#### Scenario: Creating a nested directory path
- **WHEN** user or UI requests creating a directory with path `projects/janus/specs`
- **THEN** system creates all missing intermediate parent directories and the target folder within the active Vault root

#### Scenario: Attempting directory creation outside vault root
- **WHEN** directory creation is attempted with traversal components (e.g. `../outside`) or an absolute path outside the active Vault
- **THEN** system rejects the request with an authorization security error without modifying the filesystem

#### Scenario: Creating an already existing directory
- **WHEN** directory creation is requested for a path that already exists as a folder
- **THEN** system succeeds idempotently without error

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
