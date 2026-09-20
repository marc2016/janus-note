export interface VaultInfo {
  path: string;
  name: string;
}

export interface FileNode {
  name: string;
  path: string; // Relative path with forward slashes
  is_dir: boolean;
  children?: FileNode[];
}

export interface FileChangeEvent {
  path: string;
  kind: 'create' | 'modify' | 'remove' | 'other';
}

export interface TabItem {
  path: string;
  title: string;
  isDirty: boolean;
  content: string;
  rawContent: string;
  frontmatter: Record<string, any>;
  lastSavedContent: string;
}

export type ViewMode = 'edit' | 'preview';
