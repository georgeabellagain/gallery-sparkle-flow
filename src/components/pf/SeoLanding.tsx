import { ChevronRight, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface SeoLandingProps {
  compact?: boolean;
}

export function SeoLanding({ compact }: SeoLandingProps) {
  return (
    <div className={compact ? "space-y-6" : "space-y-12"}>
      {/* Hero Section */}
      <section className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 mb-6">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-medium text-primary">New: Interactive flipbook portfolio</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Your portfolio, <span className="text-primary">beautifully animated</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Turn your PDF into a stunning, interactive flipbook. Watch your work come alive with 3D page turning and professional lighting.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/auth/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Get started free <ChevronRight size={16} />
          </Link>
          <button className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors">
            View example
          </button>
        </div>
      </section>

      {/* Colorful Flipbook Example */}
      <section className="py-12 px-6 rounded-2xl bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-primary/10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">See it in action</h2>
          
          {/* Interactive Flipbook Demo */}
          <div className="relative group">
            {/* Flipbook Container */}
            <div className="relative w-full max-w-md mx-auto aspect-[3/4] perspective">
              {/* Book Spine Shadow */}
              <div className="absolute inset-0 rounded-2xl shadow-2xl" 
                style={{
                  background: "linear-gradient(to right, rgba(0,0,0,0.2) 0%, transparent 50%)"
                }}
              />
              
              {/* Book Container */}
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-2xl"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "perspective(1200px) rotateX(2deg) rotateY(-8deg)"
                }}
              >
                {/* Left Page - Design colors */}
                <div className="absolute inset-0 w-1/2 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 flex flex-col items-center justify-center p-6 text-white">
                  <div className="text-center space-y-4">
                    <div className="text-5xl font-bold">Design</div>
                    <div className="w-16 h-1 bg-white/50 mx-auto rounded-full"></div>
                    <p className="text-sm text-white/80">Creative excellence</p>
                  </div>
                  <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mb-16"></div>
                </div>

                {/* Right Page - Photography colors */}
                <div className="absolute inset-0 left-1/2 bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 flex flex-col items-center justify-center p-6 text-white">
                  <div className="text-center space-y-4">
                    <div className="text-5xl font-bold">Photography</div>
                    <div className="w-16 h-1 bg-white/50 mx-auto rounded-full"></div>
                    <p className="text-sm text-white/80">Visual storytelling</p>
                  </div>
                  <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mt-16"></div>
                </div>
              </div>

              {/* Page Corner Animation */}
              <div className="absolute bottom-8 right-8 group-hover:translate-x-1 group-hover:translate-y-1 transition-transform duration-300">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span className="text-xs font-medium text-muted-foreground">Drag to flip</span>
                </div>
              </div>
            </div>

            {/* Feature Badges */}
            <div className="grid grid-cols-3 gap-4 mt-8 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">3D</div>
                <div className="text-xs text-muted-foreground">Page turning</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">HD</div>
                <div className="text-xs text-muted-foreground">Auto-rendered</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">∞</div>
                <div className="text-xs text-muted-foreground">Viewable</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-3 gap-6">
        {[
          {
            title: "Stunning 3D Pages",
            description: "Watch pages turn with realistic physics and lighting. Your portfolio looks professional and premium.",
            icon: "📖"
          },
          {
            title: "Studio Lighting",
            description: "Choose from multiple HDRI environments. Add scenic shadows and adjust brightness for perfect presentation.",
            icon: "💡"
          },
          {
            title: "Professional Finishes",
            description: "Satin or textured paper materials. Show your work exactly how you envision it.",
            icon: "✨"
          }
        ].map((feature, i) => (
          <div key={i} className="p-6 rounded-xl border border-border hover:border-primary/50 transition-colors">
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h3 className="font-semibold mb-2">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </section>

      {/* Why Portfolia Section */}
      <section className="bg-muted/50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-6">Why choose Portfolio Canvas?</h2>
        <ul className="space-y-3">
          {[
            "Instantly share your entire portfolio with one link",
            "Works on all devices—responsive and beautiful everywhere",
            "No design skills needed—automatic layout and styling",
            "Built-in analytics to see who views your work",
            "Optional password protection for client work",
            "Fully customizable colors and branding"
          ].map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-bold">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA Section */}
      <section className="text-center py-8">
        <h2 className="text-3xl font-bold mb-4">Ready to showcase your work?</h2>
        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
          Turn your PDF into a stunning interactive flipbook in seconds. No design skills required.
        </p>
        <Link
          to="/auth/signup"
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors text-lg"
        >
          Create your portfolio free <ChevronRight size={20} />
        </Link>
        <p className="text-xs text-muted-foreground mt-4">
          No credit card required. Start free today.
        </p>
      </section>
    </div>
  );
}
