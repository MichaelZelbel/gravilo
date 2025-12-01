import { Button } from "@/components/ui/button";
import graviloBot from "@/assets/gravilo-bot.webp";
import heroBackground from "@/assets/hero-background-grid.webp";

const Hero = () => {
  return (
    <section className="min-h-screen flex items-center justify-center px-6 pt-20 pb-20 relative">
      <div className="max-w-4xl mx-auto w-full">
        {/* Headline Above Glass Card */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight">
            Gravilo: Your AI
            <br />
            Assistant for Discord
          </h1>
        </div>

        {/* Glass Card with Bot Image */}
        <div className="relative max-w-xl mx-auto">
          {/* Background Grid Image */}
          <div className="absolute inset-0 -z-10 flex items-center justify-center">
            <img 
              src={heroBackground} 
              alt="" 
              className="w-full h-full object-cover opacity-80"
            />
          </div>

          {/* Floating code symbols */}
          <div className="absolute -left-8 top-1/4 text-3xl text-accent/60 font-mono z-10">{"{ }"}</div>
          <div className="absolute -right-8 top-1/3 text-3xl text-secondary/60 font-mono z-10">{"</>"}</div>
          <div className="absolute -left-12 bottom-1/3 text-3xl text-secondary/60 font-mono z-10">{"</>"}</div>
          <div className="absolute -right-12 bottom-1/4 text-3xl text-accent/60 font-mono z-10">{"//"}</div>
          
          {/* Main Glass Container */}
          <div className="glass-card glass-glow neon-glow-blue rounded-3xl relative overflow-visible z-10">
            {/* Bot Image - positioned so antenna peeks out top, bottom aligned with card edge */}
            <div className="relative h-[500px] flex items-end justify-center">
              <img 
                src={graviloBot} 
                alt="Gravilo Bot" 
                className="absolute bottom-0 w-full h-auto object-contain"
                style={{ maxHeight: "110%", transform: "translateY(0)" }}
              />
            </div>
          </div>

          {/* CTA Button - positioned below and overlapping glass card */}
          <div className="flex justify-center -mt-6">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-all neon-glow-purple text-lg px-12 py-6 rounded-2xl relative z-10 shadow-2xl"
            >
              Add to Discord
            </Button>
          </div>
        </div>

        {/* Subheadline below button */}
        <div className="text-center mt-8">
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Helpful, fast, always there when your community needs answers.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Hero;
