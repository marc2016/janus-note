# Spec Delta: vault-core

## Purpose

Provides secure local-first file system management, atomic read/write access for markdown and companion JSON files, directory scanning, and real-time file event notifications constrained to the active Vault folder.

## ADDED Requirements

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
