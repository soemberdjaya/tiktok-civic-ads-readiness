import { lazy, Suspense, useEffect } from 'react';
import { navigate, useRoute } from './lib/router';
import { SettingsProvider } from './lib/settings';
import { TextAudit } from './pages/TextAudit';

// The text screen loads eagerly; other screens are split per route.
const ImageAudit = lazy(() => import('./pages/ImageAudit').then((m) => ({ default: m.ImageAudit })));
const VideoAudit = lazy(() => import('./pages/VideoAudit').then((m) => ({ default: m.VideoAudit })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const History = lazy(() => import('./pages/History').then((m) => ({ default: m.History })));
const Privacy = lazy(() => import('./pages/Privacy').then((m) => ({ default: m.Privacy })));
const Rules = lazy(() => import('./pages/Rules').then((m) => ({ default: m.Rules })));

function Routes() {
  const { path } = useRoute();
  useEffect(() => {
    if (path === '/' || path === '/audit') navigate('/audit/text', true);
  }, [path]);

  switch (path) {
    case '/audit/image':
      return <ImageAudit />;
    case '/audit/video':
      return <VideoAudit />;
    case '/settings':
      return <Settings />;
    case '/history':
      return <History />;
    case '/rules':
      return <Rules />;
    case '/privacy':
      return <Privacy />;
    default:
      return <TextAudit />;
  }
}

export function App() {
  return (
    <SettingsProvider>
      <Suspense fallback={null}>
        <Routes />
      </Suspense>
    </SettingsProvider>
  );
}
