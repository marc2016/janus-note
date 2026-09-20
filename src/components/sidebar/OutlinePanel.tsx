import { Hash } from 'lucide-react';
import { useVault } from '../../context/VaultContext';

export const OutlinePanel: React.FC = () => {
  const { activeTab } = useVault();

  if (!activeTab) {
    return (
      <div className="flex flex-col h-full bg-sidebar p-4 select-none">
        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-4">
          Outline
        </div>
        <div className="text-xs text-text-dim text-center py-8">
          No document selected
        </div>
      </div>
    );
  }

  // Extract headings from markdown content
  const headings = activeTab.content
    .split('\n')
    .map(line => {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        return {
          level: match[1].length,
          text: match[2].trim()
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ level: number; text: string }>;

  return (
    <div className="flex flex-col h-full bg-sidebar select-none overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b border-border-subtle/50 flex-shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Document Outline
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {headings.length === 0 ? (
          <div className="text-xs text-text-dim text-center py-8">
            No headings found in note
          </div>
        ) : (
          headings.map((h, idx) => (
            <div
              key={idx}
              style={{ paddingLeft: `${(h.level - 1) * 12 + 6}px` }}
              className="flex items-center py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer transition-colors"
            >
              <Hash className="w-3 h-3 text-text-dim mr-1.5 flex-shrink-0" />
              <span className="truncate">{h.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
