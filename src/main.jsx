
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/app.css';

// Prevent mouse scroll from accidentally changing number input values
document.addEventListener("wheel", (e) => {
  if (document.activeElement?.type === "number") document.activeElement.blur();
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
