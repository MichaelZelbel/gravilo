import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import graviloLogo from "@/assets/gravilo-logo.webp";
import { supabase } from "@/integrations/supabase/client";

const Navigation = () => {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto glass-card glass-glow rounded-3xl px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-3">
            <img src={graviloLogo} alt="Gravilo Logo" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold text-foreground">Gravilo</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/features" className="text-foreground/80 hover:text-foreground transition-colors">
              Features
            </Link>
            <Link to="/pricing" className="text-foreground/80 hover:text-foreground transition-colors">
              Pricing
            </Link>
            <a href="/#docs" className="text-foreground/80 hover:text-foreground transition-colors">
              Docs
            </a>
          </div>

          {/* Login Button */}
          <Button onClick={handleLogin} variant="outline" className="glass-card border-border/40 hover:border-primary/40 transition-all">
            Login
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
