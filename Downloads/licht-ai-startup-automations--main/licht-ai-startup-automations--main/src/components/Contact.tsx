
import { useState } from 'react';
import { Send, Linkedin, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Create mailto link with the company email
      const mailtoLink = `mailto:light.aiautomations@gmail.com?subject=Contact from ${formData.name}&body=Name: ${formData.name}%0D%0AEmail: ${formData.email}%0D%0A%0D%0AMessage:%0D%0A${formData.message}`;
      window.location.href = mailtoLink;
      
      toast({
        title: "Message sent successfully! ✨",
        description: "Your email client has opened. Thank you for reaching out!",
      });
      
      setFormData({ name: '', email: '', message: '' });
    } catch (error) {
      toast({
        title: "Oops! Something went wrong",
        description: "Please try again or contact us directly at light.aiautomations@gmail.com",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <section id="contact" className="py-20 bg-gradient-to-br from-primary/10 via-background to-accent/10 relative overflow-hidden transition-colors duration-300">
      {/* Background Effects */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-xl animate-float transition-colors duration-300"></div>
      <div className="absolute bottom-20 right-10 w-24 h-24 bg-accent/10 rounded-full blur-xl animate-float transition-colors duration-300" style={{animationDelay: '2s'}}></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl lg:text-5xl font-bold mb-4 text-foreground transition-colors duration-300">
            Let's <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Connect</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto transition-colors duration-300">
            Ready to transform your business with AI automation? Get in touch and let's discuss your specific needs.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Contact Form */}
          <Card className="bg-card/80 backdrop-blur-md border-border/20 shadow-xl hover:shadow-2xl transition-all duration-300 animate-slide-in-left">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-foreground transition-colors duration-300">Send us a Message</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Input
                    type="text"
                    name="name"
                    placeholder="Your Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary transition-all duration-300"
                  />
                </div>
                <div>
                  <Input
                    type="email"
                    name="email"
                    placeholder="Your Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="bg-background/50 border-border/50 focus:border-primary transition-all duration-300"
                  />
                </div>
                <div>
                  <Textarea
                    name="message"
                    placeholder="Your Message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={5}
                    className="bg-background/50 border-border/50 focus:border-primary resize-none transition-all duration-300"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                  <Send className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div className="space-y-8 animate-fade-in" style={{animationDelay: '0.2s'}}>
            <div>
              <h3 className="text-3xl font-bold mb-6 text-foreground transition-colors duration-300">Get in Touch</h3>
              <p className="text-muted-foreground leading-relaxed mb-8 transition-colors duration-300">
                We're here to help you leverage the power of AI automation. Whether you need a custom solution or want to learn more about our services, don't hesitate to reach out.
              </p>
            </div>

            {/* Contact Cards */}
            <div className="space-y-4">
              <Card className="bg-card/60 backdrop-blur-md border-border/20 hover:bg-card/80 transition-all duration-300 hover:animate-card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-primary to-accent rounded-xl flex items-center justify-center transition-all duration-300">
                      <Mail className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground transition-colors duration-300">Email Us</h4>
                      <p className="text-muted-foreground transition-colors duration-300">light.aiautomations@gmail.com</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/60 backdrop-blur-md border-border/20 hover:bg-card/80 transition-all duration-300 hover:animate-card-hover">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-accent to-primary rounded-xl flex items-center justify-center transition-all duration-300">
                      <User className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground transition-colors duration-300">Founders</h4>
                      <p className="text-muted-foreground transition-colors duration-300">🐐 Goat Creator – Kiran Gowda</p>
                      <p className="text-muted-foreground transition-colors duration-300">🚀 Founder – DEEPESH.H</p>
                      <p className="text-xs text-muted-foreground transition-colors duration-300">deepesh.manju2003@gmail.com</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* LinkedIn Buttons */}
            <div className="pt-6 space-y-4">
              <Button
                variant="outline"
                className="w-full bg-transparent border-2 border-primary/30 text-foreground hover:bg-primary hover:text-primary-foreground px-8 py-3 rounded-xl font-semibold transition-all duration-300 group"
                onClick={() => window.open('https://linkedin.com', '_blank')}
              >
                <Linkedin className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
                Kiran - Connect on LinkedIn
              </Button>
              
              <Button
                variant="outline"
                className="w-full bg-transparent border-2 border-accent/30 text-foreground hover:bg-accent hover:text-primary-foreground px-8 py-3 rounded-xl font-semibold transition-all duration-300 group"
                onClick={() => window.open('https://www.linkedin.com/in/deepesh-h-916a272b0', '_blank')}
              >
                <Linkedin className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
                Deepesh - Connect on LinkedIn
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 pt-8 border-t border-border/30 transition-colors duration-300">
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 rounded-2xl p-8 backdrop-blur-sm text-center transition-all duration-300">
            <h4 className="text-2xl font-bold mb-4 text-white">
              Licht AI
            </h4>
            <p className="text-slate-300 mb-6 text-lg">
              Automations at the speed of light
            </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-slate-400">
              <span>🐐 Goat Creator – Kiran Gowda</span>
              <span className="hidden sm:block">•</span>
              <span>🚀 Founder – DEEPESH.H</span>
              <span className="hidden sm:block">•</span>
              <span>📧 light.aiautomations@gmail.com</span>
              <span className="hidden sm:block">•</span>
              <span>📧 deepesh.manju2003@gmail.com</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
