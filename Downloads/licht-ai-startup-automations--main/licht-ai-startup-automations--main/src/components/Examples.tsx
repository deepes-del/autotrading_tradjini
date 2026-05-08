import { Sparkles } from "lucide-react";
import exampleUgc1 from "@/assets/example-ugc-1.png";
import exampleUgc2 from "@/assets/example-ugc-2.png";
import exampleUgc3 from "@/assets/example-ugc-3.png";

const Examples = () => {
  const examples = [
    {
      image: exampleUgc1,
      title: "AI UGC Content Creation",
      description: "Transform simple product shots into professional UGC content with AI-enhanced visuals",
      type: "image"
    },
    {
      image: exampleUgc2,
      title: "Product Visualization",
      description: "Generate multiple product variations and lifestyle mockups instantly",
      type: "image"
    },
    {
      image: exampleUgc3,
      title: "Enhanced Marketing Assets",
      description: "Elevate your product photography with AI-powered enhancements and styling",
      type: "image"
    },
    {
      video: "/ugc_image_ads.mp4",
      title: "Client Success Story",
      description: "See real results from our AI automation services transforming content creation",
      type: "video"
    }
  ];

  return (
    <section id="examples" className="py-24 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary/10 text-primary">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Real Results</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 glow-text">
            See The Difference
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience the transformation when clients use our AI automation services
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {examples.map((example, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="aspect-[4/3] overflow-hidden">
                {example.type === "video" ? (
                  <video
                    src={example.video}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={example.image}
                    alt={example.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold mb-2 text-foreground">
                  {example.title}
                </h3>
                <p className="text-muted-foreground">
                  {example.description}
                </p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-block p-8 rounded-2xl glass-card">
            <p className="text-lg text-muted-foreground mb-4">
              Ready to transform your content?
            </p>
            <p className="text-2xl font-bold gradient-bg bg-clip-text text-transparent">
              Let's create amazing results together
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Examples;
