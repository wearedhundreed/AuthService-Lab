import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { FirebaseAuthProvider } from './context/FirebaseAuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <FirebaseAuthProvider>
    <App />
  </FirebaseAuthProvider>
);
