import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router-dom";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border p-6 hidden md:block">
        <h2 className="text-xl font-bold mb-8">Gravilo</h2>

        <nav className="space-y-4">
          <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground transition">
            Home
          </Link>
          <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground transition">
            Personality Studio
          </Link>
          <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground transition">
            Knowledge Base
          </Link>
          <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground transition">
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-8 space-y-10 overflow-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          
          <select className="bg-card border border-border rounded-lg px-4 py-2 text-foreground">
            <option>Select Server...</option>
          </select>
        </div>

        {/* Usage Card */}
        <div className="glass-card neon-glow-blue rounded-3xl p-8 max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold mb-4">Message Usage</h2>

          <div className="flex items-center gap-10">
            {/* Circular progress */}
            <div className="relative w-32 h-32">
              <div className="absolute inset-0 rounded-full border-4 border-border"></div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-primary" 
                style={{ clipPath: "inset(0 0 30% 0)" }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-xl font-semibold">
                1240 / 3000
              </div>
            </div>

            <p className="text-muted-foreground flex-1">
              Your server has used <strong className="text-foreground">1,240</strong> out of{" "}
              <strong className="text-foreground">3,000</strong> messages this cycle.
            </p>
          </div>
        </div>

        {/* Personality Studio */}
        <div className="glass-card rounded-2xl p-8 space-y-6">
          <h2 className="text-2xl font-semibold">Personality Studio</h2>

          {/* Presets */}
          <div className="flex flex-wrap gap-4">
            <Button variant="default" className="neon-glow-blue">
              Helpful Assistant
            </Button>
            <Button variant="outline">
              Sarcastic Droid
            </Button>
            <Button variant="outline">
              Wise Wizard
            </Button>
            <Button variant="outline">
              Gen Z Gamer
            </Button>
          </div>

          {/* Custom prompt */}
          <Textarea
            className="w-full h-32 bg-card border-border"
            placeholder="Custom personality prompt..."
          />

          <Button className="neon-glow-blue">
            Save
          </Button>
        </div>

        {/* Knowledge Base */}
        <div className="glass-card rounded-2xl p-8 space-y-6">
          <h2 className="text-2xl font-semibold">Knowledge Base</h2>

          {/* File upload */}
          <input
            type="file"
            className="bg-card border border-border p-4 rounded-lg text-muted-foreground w-full"
          />

          {/* List of documents */}
          <div className="space-y-3">
            <div className="flex justify-between items-center glass-card rounded-lg p-4">
              <span>rules.pdf</span>
              <span className="text-green-400">Ready</span>
            </div>

            <div className="flex justify-between items-center glass-card rounded-lg p-4">
              <span>lore.txt</span>
              <span className="text-yellow-400">Indexing...</span>
            </div>
          </div>
        </div>

        {/* Settings / Plan */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-semibold mb-4">Plan & Billing</h2>

          <p className="text-muted-foreground mb-6">
            You are currently on the <strong className="text-foreground">Premium Plan</strong>.
            Includes 3,000 messages per month, custom personality, and knowledge base.
          </p>

          <Link to="/pricing">
            <Button className="neon-glow-blue">
              Manage Subscription
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
