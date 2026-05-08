import { Card, CardContent } from '@/components/ui/card';
import { Quote } from 'lucide-react';

const Testimonials = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-primary/5 to-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-foreground">
            Client <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Testimonials</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            See how our AI automation solutions have helped businesses grow
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-8">
              <Quote className="h-10 w-10 text-primary mb-4" />
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                "The AI automation solutions completely transformed our business operations. We've saved countless hours on repetitive tasks and can now focus on growing our business. The custom chatbot alone has increased our customer satisfaction by 40%!"
              </p>
              <div className="flex items-center space-x-4">
                <div>
                  <p className="font-semibold text-foreground">Sarah Johnson</p>
                  <p className="text-sm text-muted-foreground">CEO, TechStart Solutions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/30 hover:shadow-xl transition-all duration-300">
            <CardContent className="p-8">
              <Quote className="h-10 w-10 text-accent mb-4" />
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                "Working with this team has been a game-changer. Their AI automation helped us streamline our lead management process, and we've seen a 60% increase in conversion rates. The ROI was visible within the first month. Highly recommend their services!"
              </p>
              <div className="flex items-center space-x-4">
                <div>
                  <p className="font-semibold text-foreground">Suresh Bharati</p>
                  <p className="text-sm text-muted-foreground">Founder, RealEstate Pro</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
