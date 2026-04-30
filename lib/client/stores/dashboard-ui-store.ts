"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type DashboardUiState = {
  isSidebarCollapsed: boolean;
  isMobileDrawerOpen: boolean;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  setMobileDrawerOpen: (value: boolean) => void;
};

export const useDashboardUiStore = create<DashboardUiState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      isMobileDrawerOpen: false,
      toggleSidebarCollapsed: () =>
        set((s) => ({ isSidebarCollapsed: !s.isSidebarCollapsed })),
      setSidebarCollapsed: (value) => set({ isSidebarCollapsed: value }),
      setMobileDrawerOpen: (value) => set({ isMobileDrawerOpen: value }),
    }),
    {
      name: "pdfedits:dashboard-ui",
      partialize: (s) => ({ isSidebarCollapsed: s.isSidebarCollapsed }),
    },
  ),
);
