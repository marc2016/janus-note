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

export type TabType = 'note' | 'virtual';

export interface TabItem {
  path: string;
  title: string;
  tabType?: TabType;
  isDirty: boolean;
  content: string;
  rawContent: string;
  frontmatter: Record<string, any>;
  lastSavedContent: string;
  /** Incremented whenever content is externally reset (e.g. after triage). Forces editor to re-initialise. */
  contentVersion: number;
}

export type ViewMode = 'edit' | 'preview';
