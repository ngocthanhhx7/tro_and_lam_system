import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import { startStartupLoader } from './utils/startupLoader.js';
import './styles/fonts.css';
import './styles/global.css';
import './styles/atelier.css';

const root = document.getElementById('root');
startStartupLoader(root);
createRoot(root).render(<StrictMode><App /></StrictMode>);
