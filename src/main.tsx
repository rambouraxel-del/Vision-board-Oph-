import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/nunito';
import '@fontsource/caveat/latin-500.css';
import './styles.css';
import App from './App';
import { UIProvider } from './ui';
import { registerSW } from './sw-register';

// Safari : empêcher le zoom de la page entière (le tableau gère son propre zoom)
document.addEventListener('gesturestart', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UIProvider>
      <App />
    </UIProvider>
  </StrictMode>,
);

registerSW();
