/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Connect from './pages/Connect';
import Workspace from './pages/Workspace';
import ChatOnly from './pages/ChatOnly';
import { ThemeProvider, useTheme } from './utils/ThemeContext';
import { Moon, Sun } from 'lucide-react';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-4 right-4 p-3 rounded-full bg-[var(--color-app-surface)] border border-[var(--color-app-border)] shadow-lg text-[var(--color-app-textPrimary)] hover:bg-[var(--color-app-surfaceHover)] transition-colors z-50"
      title="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ThemeToggle />
        <Routes>
          <Route path="/" element={<Navigate to="/connect" replace />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/workspace/:owner/:repo" element={<Workspace />} />
          <Route path="/chat" element={<ChatOnly />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
