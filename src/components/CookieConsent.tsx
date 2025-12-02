import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookie-consent", "declined");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-fade-in">
      <div className="max-w-3xl mx-auto px-4 pb-4">
        <div
          className="bg-background/70 backdrop-blur-xl rounded-lg shadow-sm border border-primary/20 px-4 py-2.5"
          style={{
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <p className="text-xs sm:text-sm text-foreground/90 text-center sm:text-left flex-1">
              We use cookies to keep your experience smooth and help Gravilo remember your preferences. Cool with that?
            </p>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDecline}
                className="h-8 px-3 text-xs"
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                className="h-8 px-3 text-xs"
              >
                Accept
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
