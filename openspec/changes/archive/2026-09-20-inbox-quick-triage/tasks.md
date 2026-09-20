# Tasks

## 1. Rust Backend Vault Protection & Inbox Provisioning

- [x] 1.1 Ensure `Inbox.md` is initialized at the Vault root when selecting/opening a vault in `vault.rs`, verifying with a Rust unit test
- [x] 1.2 Add protected system file validation in `vault.rs` to reject deletion (`vault_delete_item`) and moving/renaming (`vault_move_item`) when targeting `Inbox.md`, and verify rejection errors
- [x] 1.3 Add backend unit tests in `vault.rs` verifying that `Inbox.md` is auto-created if missing and protected against deletion and relocation

## 2. Pinned Inbox UI & Quick Capture Navigation

- [x] 2.1 Update `FileExplorerPanel.tsx` to filter out `Inbox.md` from the standard tree and render a dedicated pinned Inbox row at the top with an inbox icon and active selection indicator
- [x] 2.2 Wire the pinned row click event to open `Inbox.md` in the active editor tab via `openNote('Inbox.md')`
- [x] 2.3 Implement global keyboard shortcut `Cmd+Shift+I` / `Ctrl+Shift+I` to immediately open and focus `Inbox.md`
- [x] 2.4 Ensure context menu or actions on `Inbox.md` do not permit deleting or renaming the file

## 3. Interactive Triage Modal & Content Relocation

- [x] 3.1 Create `TriageModal.tsx` displaying the snippet to file, a note destination picker (autocomplete existing notes or enter a new path), and mode selection (create new note vs append)
- [x] 3.2 Implement triage execution service in `vaultService.ts` and `VaultContext.tsx` that writes/appends to the destination note and atomically removes the triaged text from `Inbox.md`
- [x] 3.3 Add prominent Inbox Action Banner with "Einsortieren" button in `TipTapEditor`, triage button in `TabBar`, bind `Cmd+Shift+T`, and ensure reactive in-editor buffer reload (`contentVersion`) without tab switching
- [x] 3.4 Implement helper function to generate the structured AI triage context payload (inbox content + vault hierarchy) in preparation for Phase 2 LLM integration

## 4. End-to-End Verification

- [x] 4.1 Run Rust tests (`cargo test`) to verify protected file validation and inbox creation pass
- [x] 4.2 Run TypeScript build (`npm run build`) to verify zero type errors across new and modified frontend components
- [x] 4.3 Verify end-to-end user workflow: opening Inbox, typing thoughts, filing into a new nested directory (`ideas/janus/note.md`), appending to an existing note, and checking that `Inbox.md` cannot be deleted
