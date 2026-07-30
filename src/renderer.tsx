import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/700.css';
import 'bulma/css/bulma.min.css';
import './index.css';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
