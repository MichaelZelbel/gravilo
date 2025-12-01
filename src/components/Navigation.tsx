import { Button } from "@/components/ui/button";

const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto glass-card glass-glow rounded-3xl px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <span className="text-xl font-bold text-foreground">Gravilo</span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-foreground/80 hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-foreground/80 hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#docs" className="text-foreground/80 hover:text-foreground transition-colors">
              Docs
            </a>
          </div>

          {/* Login Button */}
          <Button variant="outline" className="glass-card border-border/40 hover:border-primary/40 transition-all">
            Login
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
