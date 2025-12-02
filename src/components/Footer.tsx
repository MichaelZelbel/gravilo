const Footer = () => {
  return (
    <footer className="py-12 px-6 border-t border-border/20">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <a href="#terms" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#status" className="hover:text-foreground transition-colors">
              Status
            </a>
            <a href="#contact" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
          
          <p className="text-sm text-muted-foreground">
            © 2026 Gravilo AI
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
