import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { ReactLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <ReactLenis root>
        <App />
      </ReactLenis>
  </StrictMode>,
);
