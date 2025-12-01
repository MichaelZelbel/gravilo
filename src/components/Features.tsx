import FeatureCard from "./FeatureCard";
import { BookOpen, MessageSquare, Sparkles } from "lucide-react";

const Features = () => {
  return (
    <section id="features" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={BookOpen}
            title="Knowledge Base Uploads"
            description="Upload your PDFs, rules, onboarding guides, or lore. Gravilo learns them."
          />
          
          <FeatureCard
            icon={MessageSquare}
            title="Instant Answers"
            description="Gravilo replies fast, summarizes discussions, and keeps everyone informed."
          />
          
          <FeatureCard
            icon={Sparkles}
            title="Custom Personality"
            description="Make him a developer buddy, a wise wizard, a sarcastic droid, or anything else your community loves."
          />
        </div>
      </div>
    </section>
  );
};

export default Features;
