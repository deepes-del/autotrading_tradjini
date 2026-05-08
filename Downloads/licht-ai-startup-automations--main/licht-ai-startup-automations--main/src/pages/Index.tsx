import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Services from '@/components/Services';
import Testimonials from '@/components/Testimonials';
import Examples from '@/components/Examples';
import Contact from '@/components/Contact';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Services />
      <Testimonials />
      <Examples />
      <Contact />
    </div>
  );
};

export default Index;
