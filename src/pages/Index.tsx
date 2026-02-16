import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import SEOHead from "@/components/seo/SEOHead";

const Index = () => {
  return (
    <div className="min-h-screen bg-background grid-bg relative overflow-hidden">
      <SEOHead />
      {/* Ambient background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10">
        <Navigation />
        <Hero />
        <Features />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
