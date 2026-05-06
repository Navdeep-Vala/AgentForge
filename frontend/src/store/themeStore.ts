import { createSlice } from '@reduxjs/toolkit';
import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from './hooks';
import { loadPersistedTheme, persistTheme } from './persistence';
import type { RootState } from './store';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const themeSlice = createSlice({
  name: 'theme',
  initialState: {
    theme: loadPersistedTheme(),
  } as { theme: Theme },
  reducers: {
    toggle(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      persistTheme(state.theme);
    },
  },
});

export const { toggle } = themeSlice.actions;

const selectThemeState = (state: RootState) => state.theme;

export function useThemeStore(): ThemeState {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectThemeState);

  const boundToggle = useCallback(() => {
    dispatch(toggle());
  }, [dispatch]);

  return useMemo(
    () => ({
      ...state,
      toggle: boundToggle,
    }),
    [state, boundToggle]
  );
}

export default themeSlice.reducer;
