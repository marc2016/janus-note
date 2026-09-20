import { PanelRegistryProvider } from './context/PanelRegistryContext';
import { VaultProvider } from './context/VaultContext';
import { WindowHeader } from './components/layout/WindowHeader';
import { WorkspaceShell } from './components/layout/WorkspaceShell';

export function App() {
  return (
    <PanelRegistryProvider>
      <VaultProvider>
        <div className="flex flex-col h-screen w-screen bg-canvas text-text-primary overflow-hidden font-sans">
          <WindowHeader />
          <WorkspaceShell />
        </div>
      </VaultProvider>
    </PanelRegistryProvider>
  );
}

export default App;
