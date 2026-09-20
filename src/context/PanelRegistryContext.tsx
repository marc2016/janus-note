import React, { createContext, useContext, useState, useEffect } from 'react';

export interface PanelDefinition {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  badge?: string | number;
}

interface PanelRegistryContextType {
  leftPanels: PanelDefinition[];
  rightPanels: PanelDefinition[];
  activeLeftPanelId: string | null;
  activeRightPanelId: string | null;
  isLeftCollapsed: boolean;
  isRightCollapsed: boolean;
  registerLeftPanel: (panel: PanelDefinition) => void;
  registerRightPanel: (panel: PanelDefinition) => void;
  setActiveLeftPanel: (id: string) => void;
  setActiveRightPanel: (id: string) => void;
  toggleLeftCollapse: () => void;
  toggleRightCollapse: () => void;
}

const PanelRegistryContext = createContext<PanelRegistryContextType | undefined>(undefined);

const STORAGE_KEYS = {
  activeLeft: 'janus_active_left_panel',
  activeRight: 'janus_active_right_panel',
  leftCollapsed: 'janus_left_collapsed',
  rightCollapsed: 'janus_right_collapsed'
};

export const PanelRegistryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leftPanels, setLeftPanels] = useState<PanelDefinition[]>([]);
  const [rightPanels, setRightPanels] = useState<PanelDefinition[]>([]);

  const [activeLeftPanelId, setActiveLeftPanelId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.activeLeft) || 'explorer';
  });

  const [activeRightPanelId, setActiveRightPanelId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEYS.activeRight) || 'agent';
  });

  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.leftCollapsed) === 'true';
  });

  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.rightCollapsed) === 'true';
  });

  useEffect(() => {
    if (activeLeftPanelId) {
      localStorage.setItem(STORAGE_KEYS.activeLeft, activeLeftPanelId);
    }
  }, [activeLeftPanelId]);

  useEffect(() => {
    if (activeRightPanelId) {
      localStorage.setItem(STORAGE_KEYS.activeRight, activeRightPanelId);
    }
  }, [activeRightPanelId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.leftCollapsed, String(isLeftCollapsed));
  }, [isLeftCollapsed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.rightCollapsed, String(isRightCollapsed));
  }, [isRightCollapsed]);

  const registerLeftPanel = (panel: PanelDefinition) => {
    setLeftPanels(prev => {
      if (prev.some(p => p.id === panel.id)) return prev;
      return [...prev, panel];
    });
  };

  const registerRightPanel = (panel: PanelDefinition) => {
    setRightPanels(prev => {
      if (prev.some(p => p.id === panel.id)) return prev;
      return [...prev, panel];
    });
  };

  const setActiveLeftPanel = (id: string) => {
    if (isLeftCollapsed) {
      setIsLeftCollapsed(false);
    }
    setActiveLeftPanelId(id);
  };

  const setActiveRightPanel = (id: string) => {
    if (isRightCollapsed) {
      setIsRightCollapsed(false);
    }
    setActiveRightPanelId(id);
  };

  const toggleLeftCollapse = () => {
    setIsLeftCollapsed(prev => !prev);
  };

  const toggleRightCollapse = () => {
    setIsRightCollapsed(prev => !prev);
  };

  return (
    <PanelRegistryContext.Provider
      value={{
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
      }}
    >
      {children}
    </PanelRegistryContext.Provider>
  );
};

export const usePanelRegistry = () => {
  const context = useContext(PanelRegistryContext);
  if (!context) {
    throw new Error('usePanelRegistry must be used within a PanelRegistryProvider');
  }
  return context;
};
