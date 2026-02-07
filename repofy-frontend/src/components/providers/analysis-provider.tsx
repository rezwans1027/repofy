"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface AnalysisState {
  username: string;
  isAnalyzing: boolean;
  isComplete: boolean;
}

interface AnalysisContextType {
  state: AnalysisState;
  startAnalysis: (username: string) => void;
  reset: () => void;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

const initialState: AnalysisState = {
  username: "",
  isAnalyzing: false,
  isComplete: false,
};

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AnalysisState>(initialState);

  const startAnalysis = useCallback((username: string) => {
    setState({ username, isAnalyzing: true, isComplete: false });
    // Simulate analysis completing after a delay
    setTimeout(() => {
      setState((prev) => ({ ...prev, isAnalyzing: false, isComplete: true }));
    }, 2000);
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <AnalysisContext.Provider value={{ state, startAnalysis, reset }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
