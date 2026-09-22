# Spec Delta: inbox-triage

## ADDED Requirements

### Requirement: Default AI-Powered Inbox Triage Recommendation
The system SHALL automatically analyze the inbox snippet or content against the current vault hierarchy upon opening the Triage dialog, recommending the optimal target note path, action mode (`create` new note or `append` to existing note), and explanatory reasoning by default.

#### Scenario: Opening triage triggers default AI analysis
- **WHEN** user opens the Triage modal for an inbox snippet or entire inbox note
- **THEN** system immediately initiates an AI classification analysis using the active LLM provider and displays a non-blocking loading state with an option to switch to manual input

#### Scenario: Displaying AI recommendation
- **WHEN** the AI classification completes successfully
- **THEN** system displays the recommended destination path, mode badge (`create` or `append`), and a concise explanation of why that location was selected

#### Scenario: One-click acceptance and keyboard shortcut
- **WHEN** user reviews the AI recommendation and presses `Enter` or clicks "File with AI"
- **THEN** system files the snippet to the recommended path according to the proposed mode, cleans the snippet from `Inbox.md`, updates the vault file tree, and closes the modal

#### Scenario: Adjusting AI suggestion before filing
- **WHEN** user modifies the suggested target path or toggles between `create` and `append` mode
- **THEN** system preserves the user's manual adjustments and files the content according to the modified parameters upon submission

#### Scenario: Graceful fallback when AI is unavailable or fails
- **WHEN** no LLM provider or model is configured, or an API error occurs during analysis
- **THEN** system displays a non-intrusive warning or settings link and seamlessly switches to the standard manual triage input without blocking the user
