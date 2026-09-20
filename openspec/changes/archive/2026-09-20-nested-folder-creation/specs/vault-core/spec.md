# Spec Delta: vault-core

## ADDED Requirements

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
