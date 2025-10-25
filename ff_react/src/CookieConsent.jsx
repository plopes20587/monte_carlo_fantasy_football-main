import { useState, useEffect } from 'react';
import './CookieConsent.css';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const hasConsented = localStorage.getItem('analytics-consent');
    if (!hasConsented) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('analytics-consent', 'true');
    setShowBanner(false);
  };

  const handleDecline = () => {
    localStorage.setItem('analytics-consent', 'false');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="cookie-consent">
      <div className="cookie-consent-content">
        <p>
          We use analytics cookies to improve your experience and understand how our site is used.
        </p>
        <div className="cookie-consent-buttons">
          <button onClick={handleAccept} className="cookie-btn accept">
            Accept
          </button>
          <button onClick={handleDecline} className="cookie-btn decline">
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
