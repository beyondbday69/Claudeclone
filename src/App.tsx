/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Connect from './pages/Connect';
import Workspace from './pages/Workspace';
import ChatOnly from './pages/ChatOnly';
import TextAreaPlayground from './pages/TextAreaPlayground';
import { ThemeProvider } from './utils/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/connect" replace />} />
          <Route path="/connect" element={<Connect />} />
          <Route path="/workspace/:owner/:repo" element={<Workspace />} />
          <Route path="/chat" element={<ChatOnly />} />
          <Route path="/components/textarea" element={<TextAreaPlayground />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
