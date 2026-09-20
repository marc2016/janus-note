# block-editor Specification

## Purpose

Provides a block-based rich text editing experience for local Markdown files, featuring YAML frontmatter preservation and interactive embed blocks for companion JSON files.

## Requirements

### Requirement: Full Markdown Rich Rendering and View Modes
The system SHALL render standard Markdown syntax (headings H1-H6, bold, italic, strikethrough, bullet and numbered lists, task lists, blockquotes, tables, links, horizontal rules, and code blocks with syntax highlighting) with rich typography, and provide a view mode toggle between live block editing and a pure rendered reading view.

#### Scenario: Rich rendering of markdown elements
- **WHEN** a markdown document with headings, lists, tables, and formatted text is rendered
- **THEN** system applies typography styles and visual formatting matching the active theme rather than displaying raw markdown syntax

#### Scenario: Toggling between Edit and Reading mode
- **WHEN** user switches between Edit mode and Reading mode using the toolbar toggle or shortcut
- **THEN** system switches view state smoothly while keeping the active scroll position synchronized

### Requirement: YAML Frontmatter Parsing and Preservation
The system SHALL parse document YAML frontmatter into structured metadata while preserving formatting upon saving.

#### Scenario: Document with frontmatter loaded
- **WHEN** a markdown file containing YAML frontmatter is opened in the editor
- **THEN** system extracts metadata fields (such as title, tags, and companion references) and presents document body in the editor

#### Scenario: Document saved after edits
- **WHEN** user edits the document body or metadata and saves the file
- **THEN** system serializes the updated frontmatter and body into valid Markdown text

### Requirement: Interactive Companion Embed Blocks
The system SHALL render custom interactive widget blocks when codeblocks with specific language identifiers (such as `tasks` or `chart`) are present in the document.

#### Scenario: Rendering a tasks companion block
- **WHEN** a markdown document contains a codeblock with language `tasks` referencing a valid companion JSON file (e.g. `src: "sprint.tasks.json"`)
- **THEN** system renders an interactive task component inside the editor document flow

#### Scenario: Rendering a chart companion block
- **WHEN** a markdown document contains a codeblock with language `chart` referencing a valid companion JSON file (e.g. `src: "roadmap.chart.json"`)
- **THEN** system renders an interactive visualization preview inside the editor document flow

#### Scenario: Missing companion file reference
- **WHEN** an embed block references a companion file path that does not exist in the Vault
- **THEN** system displays a non-blocking placeholder indicating that the target companion file was not found with an option to create it
