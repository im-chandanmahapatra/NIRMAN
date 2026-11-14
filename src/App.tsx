import { useEffect, useState } from 'react';
import { ParsedTourUrlState, parseTourUrl } from './architecture/buildingData';
import { TourPage } from './pages/TourPage';

function getInitialTourState(): ParsedTourUrlState {
  if (typeof window === 'undefined') {
    return parseTourUrl('');
  }
  return parseTourUrl(window.location.search, import.meta.env.VITE_ANGAN_URL);
}

export default function App() {
  const [routeKey, setRouteKey] = useState(0);
  const [initialState, setInitialState] = useState<ParsedTourUrlState>(
    getInitialTourState,
  );

  useEffect(() => {
    const onPopState = () => {
      setInitialState(getInitialTourState());
      setRouteKey((k) => k + 1);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return <TourPage key={routeKey} initialState={initialState} />;
}
