import { Button } from "@/components/ui/button";
import logoChrome from "@assets/logo-chrome.png";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();
  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <div className="bg-[#0f172a] relative">
        <header className="absolute top-0 left-0 right-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={logoChrome}
                alt="Veltro"
                className="h-8 md:h-10 object-contain"
                data-testid="img-logo-nav"
              />
            </div>
            <Button
              variant="ghost"
              className="font-semibold text-gray-300 hover:text-white hover:bg-white/10"
              onClick={handleLogin}
              data-testid="button-sign-in"
            >
              Login
            </Button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#0f172a] to-[#1e293b]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#D97706]/10 via-transparent to-transparent opacity-60" />

          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-[10%] w-72 h-72 bg-[#D97706]/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]" />
            <div className="absolute top-40 right-[15%] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite_1s]" />
            <div className="absolute bottom-20 left-[20%] w-64 h-64 bg-[#D97706]/15 rounded-full blur-3xl animate-[pulse_5s_ease-in-out_infinite_2s]" />

            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(#D97706 1px, transparent 1px), linear-gradient(90deg, #D97706 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
              animation: 'gridMove 20s linear infinite'
            }} />

            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-[#D97706] rounded-full opacity-60 animate-[floatParticle_8s_ease-in-out_infinite]" />
            <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-white rounded-full opacity-40 animate-[floatParticle_6s_ease-in-out_infinite_1s]" />
            <div className="absolute top-2/3 left-1/3 w-1 h-1 bg-[#D97706] rounded-full opacity-50 animate-[floatParticle_10s_ease-in-out_infinite_2s]" />
            <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-indigo-400 rounded-full opacity-30 animate-[floatParticle_7s_ease-in-out_infinite_3s]" />
            <div className="absolute bottom-1/3 right-1/2 w-1.5 h-1.5 bg-[#D97706] rounded-full opacity-40 animate-[floatParticle_9s_ease-in-out_infinite_4s]" />

            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute top-[20%] -left-20 w-[400px] h-[1px] bg-gradient-to-r from-transparent via-[#D97706]/30 to-transparent rotate-[35deg] animate-[streak_3s_ease-in-out_infinite]" />
              <div className="absolute top-[40%] -right-20 w-[300px] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent -rotate-[35deg] animate-[streak_4s_ease-in-out_infinite_1s]" />
              <div className="absolute top-[60%] -left-10 w-[250px] h-[1px] bg-gradient-to-r from-transparent via-[#D97706]/20 to-transparent rotate-[35deg] animate-[streak_5s_ease-in-out_infinite_2s]" />
            </div>
          </div>

          <div className="container mx-auto px-6 md:px-8 py-20 md:py-28 lg:py-36 relative">
            <div className="max-w-4xl mx-auto text-center">
              <img
                src={logoChrome}
                alt="Veltro"
                className="h-32 md:h-40 lg:h-48 object-contain mx-auto mb-12 animate-[float_3s_ease-in-out_infinite]"
                style={{
                  filter: "drop-shadow(0 0 20px rgba(217, 119, 6, 0.3))"
                }}
                data-testid="img-logo-hero"
              />

              <h2
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight text-white"
                data-testid="text-hero-title"
              >
                Coming Soon...<br /><span className="text-[#D97706]">Something... WONDERFUL!</span>
              </h2>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
