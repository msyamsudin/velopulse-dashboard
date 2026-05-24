import { motion } from 'motion/react';
import { ShieldCheck, ArrowRight, Settings, Activity, Globe, Zap, Server, User } from 'lucide-react';

interface SetupLandingProps {
  onInitialize: () => void;
  missingFields: string[];
  isProfileMissing?: boolean;
}

export const SetupLanding = ({ onInitialize, missingFields, isProfileMissing }: SetupLandingProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-hw-bg overflow-hidden relative">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-4xl w-full"
      >
        <div className="hardware-card border-hw-accent/20 bg-hw-bg/40 backdrop-blur-xl p-12 relative overflow-hidden">
          {/* Accent Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-hw-accent/60" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-hw-accent mb-2">
                  <Activity size={24} className="animate-pulse" />
                  <span className="text-[10px] font-mono uppercase tracking-[0.4em] font-bold">System Initialization Required</span>
                </div>
                <h1 className="text-5xl font-black tracking-tighter leading-[1.1]">
                  WELCOME TO <br />
                  <span className="text-hw-accent">VELOPULSE</span> PRO
                </h1>
                <p className="text-hw-muted text-sm leading-relaxed max-w-md">
                  Your advanced fitness telemetry hub is almost ready. We need to establish a secure connection with your external data providers and cloud infrastructure.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-hw-muted">Connection Checklist:</h3>
                <div className="grid grid-cols-1 gap-3">
                  <CheckItem
                    label="Google Fit Integration"
                    icon={<Globe size={14} />}
                    isMissing={missingFields.some(f => f.includes('GOOGLE'))}
                  />
                  <CheckItem
                    label="Supabase Cloud Database"
                    icon={<Server size={14} />}
                    isMissing={missingFields.some(f => f.includes('SUPABASE'))}
                  />
                  <CheckItem
                    label="Application URL Configuration"
                    icon={<ShieldCheck size={14} />}
                    isMissing={missingFields.includes('APP_URL')}
                  />
                  <CheckItem
                    label="User Profile Setup (Age, Weight, FTP)"
                    icon={<User size={14} />}
                    isMissing={!!isProfileMissing}
                  />
                </div>
              </div>

              <button
                onClick={onInitialize}
                className="group relative flex items-center gap-4 px-8 py-4 bg-hw-accent text-hw-bg font-black uppercase tracking-widest text-xs rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Initialize System <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            </div>

            <div className="hidden lg:block">
              <div className="relative aspect-square">
                <div className="absolute inset-0 border-2 border-hw-accent/20 rounded-full animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-8 border border-white/10 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="p-8 bg-hw-accent/10 rounded-full border border-hw-accent/30 shadow-[0_0_50px_rgba(0,255,102,0.1)]">
                    <Settings size={80} className="text-hw-accent animate-[spin_10s_linear_infinite]" />
                  </div>
                </div>

                {/* Floating Tags */}
                <FloatingTag icon={<Zap size={10} />} label="Telemetry" pos="top-0 left-0" delay={0} />
                <FloatingTag icon={<Activity size={10} />} label="Biometrics" pos="bottom-0 right-0" delay={2} />
                <FloatingTag icon={<ShieldCheck size={10} />} label="Secure" pos="top-1/2 -right-8" delay={1} />
              </div>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-[9px] font-mono text-hw-muted uppercase tracking-[0.3em]">
          VeloPulse Core System v1.1.0 // Waiting for Handshake
        </p>
      </motion.div>
    </div>
  );
};

const CheckItem = ({ label, icon, isMissing }: { label: string; icon: React.ReactNode; isMissing: boolean }) => (
  <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isMissing ? 'bg-white/5 border-white/5 opacity-60' : 'bg-hw-accent/5 border-hw-accent/20'}`}>
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${isMissing ? 'bg-white/5 text-hw-muted' : 'bg-hw-accent/10 text-hw-accent'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-widest leading-none">{label}</span>
    </div>
    <div className={`w-1.5 h-1.5 rounded-full ${isMissing ? 'bg-hw-muted animate-pulse' : 'bg-hw-accent shadow-[0_0_10px_rgba(0,255,102,0.5)]'}`} />
  </div>
);

const FloatingTag = ({ icon, label, pos, delay }: { icon: React.ReactNode; label: string; pos: string; delay: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.5 + delay, type: "spring" }}
    className={`absolute ${pos} px-3 py-1.5 bg-hw-bg/80 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-2 z-20 shadow-xl`}
  >
    <div className="text-hw-accent">{icon}</div>
    <span className="text-[8px] font-mono uppercase tracking-widest whitespace-nowrap">{label}</span>
  </motion.div>
);
