import ReactGA from 'react-ga4';

// Check if user has consented to analytics
const hasConsent = () => {
  const consent = localStorage.getItem('analytics-consent');
  return consent === 'true';
};

// Initialize Google Analytics
export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  if (!measurementId) {
    console.warn('Google Analytics measurement ID not found. Analytics disabled.');
    return;
  }

  // Only initialize if user has consented or hasn't been asked yet
  const consent = localStorage.getItem('analytics-consent');
  if (consent === 'false') {
    console.log('Google Analytics disabled by user preference');
    return;
  }

  try {
    ReactGA.initialize(measurementId, {
      gaOptions: {
        anonymizeIp: true, // Privacy compliance
      },
      gtagOptions: {
        debug_mode: false, // Set to true for debugging
      },
    });
    console.log('Google Analytics initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Google Analytics:', error);
  }
};

// Track page views
export const trackPageView = (path) => {
  if (!hasConsent()) return;
  try {
    ReactGA.send({ hitType: 'pageview', page: path });
  } catch (error) {
    console.error('Error tracking page view:', error);
  }
};

// Track custom events
export const trackEvent = (category, action, label = null, value = null) => {
  if (!hasConsent()) return;

  try {
    const eventParams = {
      category,
      action,
    };

    if (label) eventParams.label = label;
    if (value) eventParams.value = value;

    ReactGA.event(eventParams);
  } catch (error) {
    console.error('Error tracking event:', error);
  }
};

// Specific tracking functions for app interactions
export const trackPlayerComparison = (playerA, playerB, scoringFormat) => {
  if (!hasConsent()) return;

  try {
    trackEvent('Player Comparison', 'compare', `${playerA} vs ${playerB}`, null);
    ReactGA.event({
      category: 'Player Comparison',
      action: 'compare',
      player_a: playerA,
      player_b: playerB,
      scoring_format: scoringFormat,
    });
  } catch (error) {
    console.error('Error tracking player comparison:', error);
  }
};

export const trackPlayerSelection = (playerName, playerPosition, slot) => {
  if (!hasConsent()) return;
  try {
    trackEvent('Player Selection', `select_${slot}`, `${playerName} (${playerPosition})`);
  } catch (error) {
    console.error('Error tracking player selection:', error);
  }
};

export const trackScoringFormatChange = (oldFormat, newFormat) => {
  if (!hasConsent()) return;
  try {
    trackEvent('Scoring Format', 'change', `${oldFormat} → ${newFormat}`);
  } catch (error) {
    console.error('Error tracking scoring format change:', error);
  }
};
