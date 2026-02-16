import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles, BookOpen, Zap, Shield, BarChart3 } from "lucide-react";
import SEOHead from "@/components/seo/SEOHead";

const Features = () => {
  return (
    <div className="min-h-screen bg-background grid-bg relative overflow-hidden">
      <SEOHead title="Features - Gravilo" description="Discover what Gravilo can do: instant answers, custom personality, knowledge base uploads, smart modes, and more." />
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
              What Gravilo Can Do
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Gravilo enhances your Discord server with instant answers, custom knowledge, smart assistance, and more.
            </p>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 max-w-6xl mx-auto mb-20">
            
            {/* 1. Instant Answers */}
            <div className="glass-card rounded-2xl p-8 border-primary/30 neon-glow-blue animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">Instant Answers</h2>
              </div>
              <p className="text-muted-foreground">
                Gravilo replies to questions instantly—ping him or start a message with "Hey Gravi".
                He summarizes chats, finds info, and keeps your community informed.
              </p>
            </div>

            {/* 2. Custom Personality (Premium) */}
            <div className="glass-card rounded-2xl p-8 border-secondary/30 neon-glow-purple animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="w-8 h-8 text-secondary" />
                <h2 className="text-2xl font-semibold text-foreground">Custom Personality</h2>
              </div>
              <p className="text-muted-foreground">
                Premium users can give Gravilo a full custom system prompt—make him a developer buddy,
                a wise wizard, a sarcastic droid, or anything else your community loves.
              </p>
            </div>

            {/* 3. Knowledge Base Uploads (Premium) */}
            <div className="glass-card rounded-2xl p-8 border-accent/30 animate-fade-in" style={{ 
              animationDelay: "0.2s",
              boxShadow: "0 0 25px hsl(var(--accent) / 0.2)"
            }}>
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="w-8 h-8 text-accent" />
                <h2 className="text-2xl font-semibold text-foreground">Knowledge Base Uploads</h2>
              </div>
              <p className="text-muted-foreground">
                Upload your docs, PDFs, rules, onboarding guides, or lore. 
                Gravilo learns them and gives accurate, lightning-fast answers based on your content.
              </p>
            </div>

            {/* 4. Smart Modes */}
            <div className="glass-card rounded-2xl p-8 border-primary/20 animate-fade-in" style={{ 
              animationDelay: "0.3s",
              boxShadow: "0 0 25px hsl(var(--primary) / 0.25)"
            }}>
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-8 h-8 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">Three Smart Modes</h2>
              </div>
              <p className="text-muted-foreground">
                Choose between Quiet, Normal, and Active mode.  
                Control how often Gravilo joins conversations, from minimal interruptions to
                high-engagement "always-on" support.
              </p>
            </div>

            {/* 5. Safe & Controlled */}
            <div className="glass-card rounded-2xl p-8 border-destructive/30 animate-fade-in" style={{ 
              animationDelay: "0.4s",
              boxShadow: "0 0 25px hsl(var(--destructive) / 0.2)"
            }}>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-8 h-8 text-destructive" />
                <h2 className="text-2xl font-semibold text-foreground">Safe & Controlled</h2>
              </div>
              <p className="text-muted-foreground">
                Gravilo never responds in DMs or NSFW channels.  
                Strict safety modes ensure he avoids roleplay, NSFW, personal advice, and keeps communities safe.
              </p>
            </div>

            {/* 6. Analytics & Insights (Premium) */}
            <div className="glass-card rounded-2xl p-8 border-orange-400/30 animate-fade-in" style={{ 
              animationDelay: "0.5s",
              boxShadow: "0 0 25px rgba(251, 146, 60, 0.2)"
            }}>
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-8 h-8 text-orange-400" />
                <h2 className="text-2xl font-semibold text-foreground">Analytics & Insights</h2>
              </div>
              <p className="text-muted-foreground">
                Track message usage, channel activity, and bot performance over time with a dedicated dashboard.
                Perfect for community managers and creators.
              </p>
            </div>

          </div>

          {/* Call to Action */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-6">Ready to Upgrade Your Server?</h2>
            
            <Link to="/pricing">
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-10 py-6 text-lg shadow-xl neon-glow-blue"
              >
                View Plans
              </Button>
            </Link>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default Features;
