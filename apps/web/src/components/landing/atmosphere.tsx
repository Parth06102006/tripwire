/**
 * Fixed atmosphere behind the framed canvas:
 * Reproduces the painterly classical landscape aesthetic from the baseline design:
 * golden-hour dusk clouds along the upper horizon, deep autumnal forest canopy
 * tones at the base, ambient ember warmth, and photographic grain.
 */
export default function Atmosphere() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Base warm umber canvas */}
      <div className="absolute inset-0 bg-[#0c0a08]" />

      {/* Classical sky: layered golden-hour ochre, amber and burnt sienna clouds */}
      <div className="absolute inset-x-0 top-0 h-[65vh] bg-[radial-gradient(120%_90%_at_50%_-10%,#c97b32_0%,#8c4a1e_32%,#3a1d10_65%,transparent_85%)] opacity-85" />

      {/* Cloud billows in the upper left and right corners */}
      <div className="absolute -top-24 -left-20 h-[36rem] w-[46rem] rounded-full bg-[radial-gradient(circle_at_35%_35%,#e08e3d_0%,#b56526_40%,#462012_75%,transparent_90%)] opacity-80 blur-3xl" />
      <div className="absolute -top-28 -right-24 h-[38rem] w-[48rem] rounded-full bg-[radial-gradient(circle_at_65%_35%,#d88435_0%,#a2531d_42%,#3f1b0e_75%,transparent_90%)] opacity-75 blur-3xl" />
      <div className="absolute top-12 left-1/4 h-[24rem] w-[34rem] rounded-full bg-[radial-gradient(circle,#f29d47_0%,#be6a24_45%,transparent_75%)] opacity-60 blur-2xl" />

      {/* Mid-sky horizon glow */}
      <div className="absolute inset-x-0 top-[28%] h-[40vh] bg-[radial-gradient(85%_55%_at_50%_40%,rgba(242,140,56,0.28),rgba(164,80,30,0.12)_50%,transparent_75%)]" />

      {/* Forest canopy and landscape base: deep umber, olive-tinted dark forest silhouettes */}
      <div className="absolute inset-x-0 bottom-0 h-[45vh] bg-[linear-gradient(to_top,#0e0b09_0%,#18120d_45%,#261a11_70%,transparent_100%)]" />

      {/* Bottom foliage masses on left and right borders */}
      <div className="absolute -bottom-16 -left-16 h-[32rem] w-[38rem] rounded-full bg-[radial-gradient(circle,#1d1712_0%,#14100c_55%,transparent_80%)] opacity-90 blur-xl" />
      <div className="absolute -right-16 -bottom-16 h-[32rem] w-[38rem] rounded-full bg-[radial-gradient(circle,#1b1510_0%,#120e0a_55%,transparent_80%)] opacity-90 blur-xl" />

      {/* Organic painterly tree canopy silhouette accents using SVG */}
      <svg
        className="absolute inset-x-0 bottom-0 h-44 w-full opacity-65 mix-blend-multiply"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        fill="currentColor"
      >
        <path
          d="M0,220 L0,120 Q60,70 140,110 Q210,60 280,105 Q350,55 420,95 Q490,45 560,90 Q640,65 720,115 Q800,50 880,95 Q960,40 1040,85 Q1120,60 1200,100 Q1280,45 1360,90 Q1410,65 1440,100 L1440,220 Z"
          className="text-[#100d0a]"
        />
        <path
          d="M0,220 L0,150 Q90,95 180,140 Q290,85 390,135 Q500,90 610,130 Q720,105 820,145 Q940,95 1060,135 Q1180,90 1290,130 Q1380,105 1440,140 L1440,220 Z"
          className="text-[#0a0806]"
        />
      </svg>

      {/* Subtle organic atmospheric drift */}
      <div className="absolute top-0 -left-20 h-[36rem] w-[36rem] animate-drift rounded-full bg-[radial-gradient(circle,rgba(242,140,56,0.18),transparent_65%)] blur-3xl" />
      <div className="absolute top-10 right-0 h-[32rem] w-[32rem] animate-drift rounded-full bg-[radial-gradient(circle,rgba(214,96,44,0.15),transparent_65%)] blur-3xl [animation-delay:-9s]" />

      {/* Classical canvas vignette & film grain */}
      <div className="grain-layer absolute inset-0 opacity-[0.08] mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(6,5,4,0.65)_100%)]" />
    </div>
  );
}
