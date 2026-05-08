import { useState, useEffect } from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const Header = () => {
  const { toast } = useToast();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'You have been logged out',
      });
    }
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
      isScrolled ? 'bg-background/95 backdrop-blur-md shadow-lg border-b border-border/50' : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center justify-between">
          {/* Logo and Company Name */}
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/e5c4ceca-75b5-44af-bfc5-c1053552ed08.png" 
              alt="Licht AI Logo" 
              className="w-10 h-10 object-contain transition-transform duration-300 hover:scale-110"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent transition-all duration-300">
              Licht AI
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => scrollToSection('home')}
              className="relative text-foreground/80 hover:text-foreground transition-colors duration-300 group"
            >
              Home
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent transition-all duration-300 group-hover:w-full"></span>
            </button>
            <button
              onClick={() => scrollToSection('services')}
              className="relative text-foreground/80 hover:text-foreground transition-colors duration-300 group"
            >
              Services
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent transition-all duration-300 group-hover:w-full"></span>
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="relative text-foreground/80 hover:text-foreground transition-colors duration-300 group"
            >
              Contact
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent transition-all duration-300 group-hover:w-full"></span>
            </button>
            <a
              href="https://bot.lichtai.in"
              target="_blank"
              rel="noopener noreferrer"
              className="relative text-foreground/80 hover:text-foreground transition-colors duration-300 group"
            >
              Trading Bot
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent transition-all duration-300 group-hover:w-full"></span>
            </a>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut size={16} />
              Logout
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden transition-all duration-300 hover:bg-card/50"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X size={20} className="transition-transform duration-300 rotate-90" />
            ) : (
              <Menu size={20} className="transition-transform duration-300" />
            )}
          </Button>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 py-4 bg-background/95 backdrop-blur-md rounded-lg shadow-lg border border-border/50 animate-slide-in-left transition-all duration-300">
            <div className="flex flex-col space-y-4 px-4">
              <button
                onClick={() => scrollToSection('home')}
                className="text-left text-foreground/80 hover:text-foreground transition-colors duration-300 hover:translate-x-2 transform"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection('services')}
                className="text-left text-foreground/80 hover:text-foreground transition-colors duration-300 hover:translate-x-2 transform"
              >
                Services
              </button>
              <button
                onClick={() => scrollToSection('contact')}
                className="text-left text-foreground/80 hover:text-foreground transition-colors duration-300 hover:translate-x-2 transform"
              >
                Contact
              </button>
              <a
                href="https://bot.lichtai.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-left text-foreground/80 hover:text-foreground transition-colors duration-300 hover:translate-x-2 transform"
              >
                Trading Bot
              </a>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 w-full"
              >
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
