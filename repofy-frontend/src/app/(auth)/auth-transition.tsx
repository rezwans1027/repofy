"use client";

import { createContext, useContext } from "react";

export const AuthTransitionContext = createContext<{
  navigateTo: (path: string) => void;
}>({
  navigateTo: () => {},
});

export const useAuthTransition = () => useContext(AuthTransitionContext);
