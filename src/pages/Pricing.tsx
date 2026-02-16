import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background grid-bg relative overflow-hidden">
      <SEOHead title="Pricing - Gravilo" description="Simple, fair pricing for every Discord community. Free, Premium, and Enterprise plans available." />
      {/* Ambient background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10">
        <Navigation />
        
        {/* Page Content */}
        <div className="min-h-screen px-6 py-32">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Pricing
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl">
              Simple. Fair. Built for every community.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
            
            {/* Free Tier */}
            <div className="glass-card glass-glow rounded-2xl p-8 flex flex-col">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Free</h2>
              <p className="text-muted-foreground mb-4">For casual servers and testing</p>
              <p className="text-4xl font-bold text-foreground mb-6">$0</p>

              <ul className="space-y-3 text-muted-foreground flex-grow mb-8">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>1 Server</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>300 Messages / month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Gemini Flash</span>
                </li>
                <li className="flex items-start gap-2 opacity-50">
                  <span className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>No custom personality</span>
                </li>
                <li className="flex items-start gap-2 opacity-50">
                  <span className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <span>No knowledge base</span>
                </li>
              </ul>

              <Button 
                size="lg" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg"
              >
                Start Free
              </Button>
            </div>

            {/* Premium Tier - Highlighted */}
            <div className="relative glass-card rounded-2xl p-8 flex flex-col neon-glow-purple border-primary/30">
              
              {/* Most Popular Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary px-4 py-1 rounded-full text-sm font-semibold text-primary-foreground shadow-lg">
                Most Popular
              </div>

              <h2 className="text-2xl font-semibold text-foreground mb-2">Premium</h2>
              <p className="text-foreground/80 mb-4">For active communities and creators</p>
              <p className="text-4xl font-bold text-foreground mb-6">
                $14.99 <span className="text-lg font-normal text-muted-foreground">/ month</span>
              </p>

              <ul className="space-y-3 text-foreground/90 flex-grow mb-8">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Unlimited servers</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>3,000 Messages / month</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Gemini 3</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Custom personality</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Knowledge base uploads</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Analytics dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Active AI mode</span>
                </li>
              </ul>

              <Button 
                size="lg" 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-xl neon-glow-blue"
              >
                Upgrade to Premium
              </Button>
            </div>

            {/* Enterprise Tier */}
            <div className="glass-card glass-glow rounded-2xl p-8 flex flex-col">
              <h2 className="text-2xl font-semibold text-foreground mb-2">Enterprise</h2>
              <p className="text-muted-foreground mb-4">For large communities and advanced teams</p>
              <p className="text-4xl font-bold text-foreground mb-6">Contact</p>

              <ul className="space-y-3 text-muted-foreground flex-grow mb-8">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Custom message limits</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Dedicated models</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Multi-bot support</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Advanced automations</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                  <span>Enterprise SLA</span>
                </li>
              </ul>

              <Button 
                size="lg" 
                variant="outline"
                className="w-full glass-card border-border/40 hover:bg-background/80 rounded-full"
              >
                Contact Us
              </Button>
            </div>

          </div>

          {/* Footer Text */}
          <div className="text-center text-muted-foreground/60">
            © 2026 Gravilo AI — All rights reserved.
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default Pricing;
