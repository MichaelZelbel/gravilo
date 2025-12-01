import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20">
      <div className="max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-secondary bg-clip-text text-transparent">
            Gravilo: Your AI Assistant for Discord
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            Helpful, fast, always there when your community needs answers.
          </p>
        </div>

        {/* Hero Image Container with Glass Effect */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="glass-card glass-glow neon-glow-blue rounded-3xl p-8 relative overflow-hidden">
            {/* Placeholder for hero image */}
            <div className="aspect-square bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-8xl mb-4">🤖</div>
                <p className="text-muted-foreground">Hero image placeholder</p>
                <p className="text-sm text-muted-foreground/60 mt-2">Upload your robot character here</p>
              </div>
            </div>

            {/* CTA Button positioned at bottom */}
            <div className="mt-8 flex justify-center">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all neon-glow-purple text-lg px-12 py-6 rounded-2xl"
              >
                Add to Discord
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
