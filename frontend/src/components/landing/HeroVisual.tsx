"use client";

/**
 * Abstract decorative visual for the hero section right side.
 * Floating glassmorphism cards with prediction-market motifs,
 * particle stars, connecting lines, and atmospheric effects.
 */
export function HeroVisual() {
  return (
    <div className="relative w-full h-[440px] select-none" aria-hidden="true">

      {/* ── Ambient glow layers ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-teal-500/8 blur-[100px]" />
      <div className="absolute top-[20%] right-[10%] w-48 h-48 rounded-full bg-teal-400/6 blur-[70px]" />
      <div className="absolute bottom-[15%] left-[15%] w-32 h-32 rounded-full bg-emerald-500/5 blur-[50px]" />

      {/* ── Grid pattern overlay ── */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="heroGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#14b8a6" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#heroGrid)" />
      </svg>

      {/* ── Connecting lines between cards (SVG) ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 440">
        <line x1="250" y1="140" x2="400" y2="30" stroke="#14b8a6" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="4 4" className="hero-dash-animate" />
        <line x1="250" y1="140" x2="80" y2="340" stroke="#14b8a6" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="4 4" className="hero-dash-animate" />
        <line x1="250" y1="140" x2="430" y2="380" stroke="#14b8a6" strokeWidth="0.5" strokeOpacity="0.12" strokeDasharray="4 4" className="hero-dash-animate" />
        <line x1="250" y1="140" x2="440" y2="200" stroke="#14b8a6" strokeWidth="0.5" strokeOpacity="0.12" strokeDasharray="4 4" className="hero-dash-animate" />
      </svg>

      {/* ── Floating particle stars ── */}
      {[
        { top: "8%", left: "12%", size: "2px", delay: "0s", dur: "3s" },
        { top: "18%", left: "78%", size: "1.5px", delay: "1.2s", dur: "4s" },
        { top: "65%", left: "5%", size: "1px", delay: "0.5s", dur: "3.5s" },
        { top: "82%", left: "45%", size: "2px", delay: "2s", dur: "4.5s" },
        { top: "35%", left: "92%", size: "1.5px", delay: "0.8s", dur: "3s" },
        { top: "50%", left: "25%", size: "1px", delay: "1.5s", dur: "5s" },
        { top: "12%", left: "55%", size: "1.5px", delay: "2.5s", dur: "3.5s" },
        { top: "90%", left: "85%", size: "1px", delay: "0.3s", dur: "4s" },
        { top: "72%", left: "65%", size: "2px", delay: "1.8s", dur: "3s" },
        { top: "42%", left: "8%", size: "1.5px", delay: "3s", dur: "4.5s" },
        { top: "5%", left: "40%", size: "1px", delay: "0.7s", dur: "5s" },
        { top: "55%", left: "50%", size: "1.5px", delay: "2.2s", dur: "3.5s" },
      ].map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-teal-300 hero-star"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animationDelay: star.delay,
            animationDuration: star.dur,
            boxShadow: `0 0 4px rgba(20,184,166,0.6)`,
          }}
        />
      ))}

      {/* ── Main floating card — BTC ── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[260px] hero-float" style={{ animationDelay: "0s" }}>
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[9px] font-bold text-white shadow-lg shadow-amber-500/20">B</div>
              <span className="text-sm font-semibold text-white">BTC / USD</span>
            </div>
            <span className="text-xs font-mono text-emerald-400">+2.4%</span>
          </div>
          <svg viewBox="0 0 200 50" className="w-full h-12 overflow-visible">
            <defs>
              <linearGradient id="heroLine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0,40 C20,38 40,35 60,30 S100,15 120,20 S160,10 180,8 L200,5" fill="none" stroke="#14b8a6" strokeWidth="2" className="hero-draw-line" />
            <path d="M0,40 C20,38 40,35 60,30 S100,15 120,20 S160,10 180,8 L200,5 L200,50 L0,50 Z" fill="url(#heroLine)" className="hero-draw-line" />
            {/* Price dot at end */}
            <circle cx="200" cy="5" r="3" fill="#14b8a6" className="hero-pulse-dot">
              <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-emerald-400 font-medium">68% UP</span>
            <span className="text-red-400 font-medium">32% DOWN</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: "rgba(30,41,59,0.5)" }}>
            <div className="bg-emerald-500 h-full transition-all" style={{ width: "68%" }} />
            <div className="bg-red-500 h-full transition-all" style={{ width: "32%" }} />
          </div>
        </div>
      </div>

      {/* ── UP indicator (top-right) ── */}
      <div className="absolute top-0 right-2 hero-float" style={{ animationDelay: "1s" }}>
        <div className="glass-card px-3 py-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 2L8 6H2L5 2Z" fill="#10b981" />
            </svg>
          </div>
          <div>
            <p className="text-[9px] text-slate-500">Prediction</p>
            <p className="text-xs font-bold text-emerald-400">UP</p>
          </div>
        </div>
      </div>

      {/* ── Timer (bottom-left) ── */}
      <div className="absolute bottom-14 left-0 hero-float" style={{ animationDelay: "2s" }}>
        <div className="glass-card px-4 py-2.5">
          <p className="text-[9px] text-slate-500 mb-0.5">Expires in</p>
          <p className="text-xl font-mono font-black text-teal-400 neon-text-subtle tracking-wider">14:59</p>
        </div>
      </div>

      {/* ── Payout badge (bottom-right) ── */}
      <div className="absolute bottom-2 right-4 hero-float" style={{ animationDelay: "0.5s" }}>
        <div className="glass-card px-3 py-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center text-[9px] font-bold text-teal-400">$</div>
          <div>
            <p className="text-[9px] text-slate-500">Payout</p>
            <p className="text-xs font-bold text-white">1.87x</p>
          </div>
        </div>
      </div>

      {/* ── SOL mini card (left side, mid) ── */}
      <div className="absolute top-[38%] -left-2 hero-float" style={{ animationDelay: "2.5s" }}>
        <div className="glass-card px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-[7px] font-bold text-white">S</div>
            <span className="text-[10px] font-semibold text-white">SOL</span>
            <span className="text-[9px] text-emerald-400 ml-auto">+1.2%</span>
          </div>
          <svg viewBox="0 0 80 24" className="w-16 h-5">
            <path d="M0,18 C10,16 20,12 30,10 S50,6 60,8 S70,4 80,2" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ── ETH mini card (right side, mid) ── */}
      <div className="absolute top-[48%] right-0 hero-float" style={{ animationDelay: "1.5s" }}>
        <div className="glass-card px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-[7px] font-bold text-white">E</div>
            <span className="text-[10px] font-semibold text-white">ETH</span>
            <span className="text-[9px] text-red-400 ml-auto">-0.3%</span>
          </div>
          <svg viewBox="0 0 80 24" className="w-16 h-5">
            <path d="M0,12 C10,10 20,15 30,18 S50,20 60,14 S70,8 80,12" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ── DOWN indicator (lower-center-left) ── */}
      <div className="absolute bottom-[38%] left-[28%] hero-float" style={{ animationDelay: "3s" }}>
        <div className="glass-card px-2.5 py-1.5 flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M5 8L2 4H8L5 8Z" fill="#ef4444" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-red-400">DOWN</span>
        </div>
      </div>

      {/* ── Orbiting dots ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56">
        <div className="hero-orbit w-full h-full">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-teal-400" style={{ boxShadow: "0 0 8px rgba(20,184,166,0.6)" }} />
        </div>
        <div className="hero-orbit-reverse w-full h-full absolute inset-0">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-300/50" style={{ boxShadow: "0 0 6px rgba(20,184,166,0.4)" }} />
        </div>
      </div>

      {/* ── Larger orbit ring (visible) ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-teal-500/[0.06]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full border border-teal-500/[0.03]" />
    </div>
  );
}
