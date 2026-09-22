import React, { useEffect } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { 
  FolderTree, 
  Search, 
  Bot, 
  AlignLeft, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { usePanelRegistry } from '../../context/PanelRegistryContext';
import { FileExplorerPanel } from '../sidebar/FileExplorerPanel';
import { SearchPanel } from '../sidebar/SearchPanel';
import { JanusAgentPanel } from '../sidebar/JanusAgentPanel';
import { OutlinePanel } from '../sidebar/OutlinePanel';
import { TabBar } from '../tabs/TabBar';
import { TipTapEditor } from '../editor/TipTapEditor';
import { AiConfigView } from '../config/AiConfigView';
import { useVault } from '../../context/VaultContext';

export const WorkspaceShell: React.FC = () => {
  const {
    leftPanels,
    rightPanels,
    activeLeftPanelId,
    activeRightPanelId,
    isLeftCollapsed,
    isRightCollapsed,
    registerLeftPanel,
    registerRightPanel,
    setActiveLeftPanel,
    setActiveRightPanel,
    toggleLeftCollapse,
    toggleRightCollapse
  } = usePanelRegistry();

  const { activeTabPath, activeTab } = useVault();
  const isVirtualAiConfig = activeTabPath === 'virtual:ai-config' || activeTab?.tabType === 'virtual';

  // Register default panels on mount
  useEffect(() => {
    registerLeftPanel({
      id: 'explorer',
      title: 'File Explorer',
      icon: FolderTree,
      component: FileExplorerPanel
    });

    registerLeftPanel({
      id: 'search',
      title: 'Search Vault',
      icon: Search,
      component: SearchPanel
    });

    registerRightPanel({
      id: 'agent',
      title: 'Janus Agent',
      icon: Bot,
      component: JanusAgentPanel
    });

    registerRightPanel({
      id: 'outline',
      title: 'Outline',
      icon: AlignLeft,
      component: OutlinePanel
    });
  }, [registerLeftPanel, registerRightPanel]);

  const activeLeft = leftPanels.find(p => p.id === activeLeftPanelId) || leftPanels[0];
  const activeRight = rightPanels.find(p => p.id === activeRightPanelId) || rightPanels[0];

  const LeftComponent = activeLeft?.component || FileExplorerPanel;
  const RightComponent = activeRight?.component || JanusAgentPanel;

  return (
    <div className="flex-1 flex overflow-hidden w-full h-full bg-canvas">
      {/* Left Activity Bar (Permanent narrow icon strip) */}
      <div className="w-12 bg-sidebar border-r border-border-subtle flex flex-col items-center py-2 select-none flex-shrink-0 z-10 justify-between">
        <div className="flex flex-col items-center space-y-1 w-full">
          {leftPanels.map(panel => {
            const Icon = panel.icon;
            const isActive = !isLeftCollapsed && activeLeftPanelId === panel.id;

            return (
              <button
                key={panel.id}
                onClick={() => {
                  if (isActive) {
                    toggleLeftCollapse();
                  } else {
                    setActiveLeftPanel(panel.id);
                  }
                }}
                title={panel.title}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-surface text-accent shadow-sm border border-border-subtle'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        <button
          onClick={toggleLeftCollapse}
          title={isLeftCollapsed ? 'Expand Left Sidebar' : 'Collapse Left Sidebar'}
          className="w-8 h-8 rounded-md flex items-center justify-center text-text-dim hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          {isLeftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Resizable 3-Column Panel Group */}
      <Group orientation="horizontal" id="janus-workspace-group-v2" className="flex-1">
        {/* Left Sidebar Pane */}
        {!isLeftCollapsed && (
          <>
            <Panel
              id="left-sidebar-panel"
              defaultSize={260}
              minSize={180}
              maxSize={500}
              groupResizeBehavior="preserve-pixel-size"
              className="bg-sidebar flex flex-col border-r border-border-subtle overflow-hidden"
            >
              <LeftComponent />
            </Panel>

            <Separator className="w-1.5 hover:w-1.5 bg-transparent hover:bg-accent/40 active:bg-accent transition-colors flex items-center justify-center cursor-col-resize z-20 group">
              <div className="w-0.5 h-8 bg-border-strong group-hover:bg-accent rounded-full transition-colors pointer-events-none" />
            </Separator>
          </>
        )}

        {/* Center Main Editor Canvas */}
        <Panel
          id="center-editor-panel"
          minSize={350}
          groupResizeBehavior="preserve-relative-size"
          className="flex flex-col bg-canvas overflow-hidden"
        >
          <TabBar />
          {isVirtualAiConfig ? <AiConfigView /> : <TipTapEditor />}
        </Panel>

        {/* Right Sidebar Pane */}
        {!isRightCollapsed && (
          <>
            <Separator className="w-1.5 hover:w-1.5 bg-transparent hover:bg-accent/40 active:bg-accent transition-colors flex items-center justify-center cursor-col-resize z-20 group">
              <div className="w-0.5 h-8 bg-border-strong group-hover:bg-accent rounded-full transition-colors pointer-events-none" />
            </Separator>

            <Panel
              id="right-sidebar-panel"
              defaultSize={340}
              minSize={240}
              maxSize={600}
              groupResizeBehavior="preserve-pixel-size"
              className="bg-sidebar flex flex-col border-l border-border-subtle overflow-hidden"
            >
              <RightComponent />
            </Panel>
          </>
        )}
      </Group>

      {/* Right Activity Bar (Permanent narrow icon strip) */}
      <div className="w-12 bg-sidebar border-l border-border-subtle flex flex-col items-center py-2 select-none flex-shrink-0 z-10 justify-between">
        <div className="flex flex-col items-center space-y-1 w-full">
          {rightPanels.map(panel => {
            const Icon = panel.icon;
            const isActive = !isRightCollapsed && activeRightPanelId === panel.id;

            return (
              <button
                key={panel.id}
                onClick={() => {
                  if (isActive) {
                    toggleRightCollapse();
                  } else {
                    setActiveRightPanel(panel.id);
                  }
                }}
                title={panel.title}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-surface text-accent shadow-sm border border-border-subtle'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        <button
          onClick={toggleRightCollapse}
          title={isRightCollapsed ? 'Expand Right Sidebar' : 'Collapse Right Sidebar'}
          className="w-8 h-8 rounded-md flex items-center justify-center text-text-dim hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          {isRightCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
