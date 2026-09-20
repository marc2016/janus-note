# Spec Delta: vault-core

## ADDED Requirements

### Requirement: Protected System Files Management
The system SHALL prevent deletion, renaming, or relocating of reserved protected system files (specifically `Inbox.md` at the Vault root) across all vault file modification commands.

#### Scenario: Blocking deletion of protected root file
- **WHEN** a client or user invokes `vault_delete_item` targeting `Inbox.md` at the vault root
- **THEN** system rejects the operation with a validation error indicating that protected system files cannot be deleted

#### Scenario: Blocking renaming or moving of protected root file
- **WHEN** a client or user invokes `vault_move_item` targeting `Inbox.md` at the vault root as source
- **THEN** system rejects the relocation with a validation error indicating that protected system files cannot be moved or renamed
