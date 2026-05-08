import { useState } from 'react';
import { Calendar, Send, Phone, User, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const BookMeeting = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    requirements: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const mailtoLink = `mailto:light.aiautomations@gmail.com?subject=Meeting Request from ${encodeURIComponent(formData.name)}&body=Name: ${encodeURIComponent(formData.name)}%0D%0APhone: ${encodeURIComponent(formData.phone)}%0D%0A%0D%0ARequirements:%0D%0A${encodeURIComponent(formData.requirements)}`;
      window.location.href = mailtoLink;
      
      toast({
        title: "Meeting request sent!",
        description: "We'll get back to you within 24 hours to schedule your meeting.",
      });
      
      setFormData({ name: '', phone: '', requirements: '' });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again or contact us directly.",
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-primary-foreground px-10 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group"
        >
          <Calendar className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
          Book a Meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Schedule a Meeting
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Fill in your details and we'll reach out to schedule a consultation.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Your Name
            </label>
            <Input
              type="text"
              name="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="bg-background/50 border-border/50 focus:border-primary transition-all duration-300"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Phone Number
            </label>
            <Input
              type="tel"
              name="phone"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={handleInputChange}
              required
              className="bg-background/50 border-border/50 focus:border-primary transition-all duration-300"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              What do you need?
            </label>
            <Textarea
              name="requirements"
              placeholder="Describe your automation needs..."
              value={formData.requirements}
              onChange={handleInputChange}
              required
              rows={4}
              className="bg-background/50 border-border/50 focus:border-primary resize-none transition-all duration-300"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group"
          >
            {isSubmitting ? 'Sending...' : 'Request Meeting'}
            <Send className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookMeeting;
