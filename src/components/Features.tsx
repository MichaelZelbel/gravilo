import FeatureCard from "./FeatureCard";
import { Shield, MessageSquare, Terminal } from "lucide-react";

const Features = () => {
  return (
    <section id="features" className="py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={Shield}
            title="Smart Moderation"
            description="Keeps conversations clean, friendly, and on-topic — automatically."
          />
          
          <FeatureCard
            icon={MessageSquare}
            title="Instant Answers"
            description="Gravilo replies fast, summarizes discussions, and keeps everyone informed."
          />
          
          <FeatureCard
            icon={Terminal}
            title="Custom Commands"
            description="Build tailor-made commands and workflows for your community."
          />
        </div>
      </div>
    </section>
  );
};

export default Features;
