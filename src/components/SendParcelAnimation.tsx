import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onComplete: () => void;
};

/**
 * Full-screen overlay micro-interaction:
 * 1. Box appears + flaps close + tape seals
 * 2. Truck drives in from left
 * 3. Box lifts into truck cargo
 * 4. Doors close, truck bounces, drives off right with speed lines
 * 5. Success checkmark fades in
 *
 * Total duration ~3.2s. Trigger by setting `open=true`; fires `onComplete` when done.
 */
export function SendParcelAnimation({ open, onComplete }: Props) {
  useEffect(() => {
    if (!open) return;
    // Optional packing sound (soft tape/whoosh) — synthesized so no asset needed
    try {
      const AC =
        (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        const playBlip = (freq: number, at: number, dur = 0.12) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
          g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + at + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + at);
          o.stop(ctx.currentTime + at + dur + 0.05);
        };
        playBlip(420, 0.15); // flap
        playBlip(380, 0.45); // flap
        playBlip(220, 0.85, 0.25); // tape
        playBlip(160, 2.4, 0.2); // truck horn-ish
      }
    } catch {
      // sound is optional — silently ignore
    }

    const t = setTimeout(onComplete, 3200);
    return () => clearTimeout(t);
  }, [open, onComplete]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="relative w-full max-w-3xl h-[280px] overflow-hidden">
            {/* Road */}
            <div className="absolute left-0 right-0 bottom-12 h-0.5 bg-border" />
            {/* Moving road dashes */}
            <motion.div
              className="absolute left-0 right-0 bottom-[46px] h-0.5 flex gap-3"
              initial={{ x: 0 }}
              animate={{ x: [-0, -60] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
            >
              {Array.from({ length: 40 }).map((_, i) => (
                <span key={i} className="block w-8 h-0.5 bg-muted-foreground/40 rounded-full" />
              ))}
            </motion.div>

            {/* Drifting clouds */}
            <motion.div
              className="absolute top-4 left-0 text-muted-foreground/30 text-2xl"
              initial={{ x: -50 }}
              animate={{ x: "110vw" }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              ☁️
            </motion.div>
            <motion.div
              className="absolute top-10 left-0 text-muted-foreground/20 text-xl"
              initial={{ x: -200 }}
              animate={{ x: "110vw" }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear", delay: 2 }}
            >
              ☁️
            </motion.div>

            {/* PARCEL BOX — packs, then lifts into truck cargo */}
            <motion.div
              className="absolute left-1/2 -translate-x-1/2"
              style={{ bottom: 60 }}
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{
                scale: [0, 1, 1, 1, 1, 0.85],
                opacity: [0, 1, 1, 1, 1, 0],
                y: [20, 0, 0, 0, -10, -10],
                x: [0, 0, 0, 0, -40, -40],
              }}
              transition={{
                duration: 2.2,
                times: [0, 0.15, 0.4, 0.7, 0.85, 1],
                ease: "easeInOut",
              }}
            >
              <BoxSvg />
            </motion.div>

            {/* TRUCK — enters from left, stops, bounces, exits right */}
            <motion.div
              className="absolute bottom-12"
              initial={{ x: "-60%" }}
              animate={{
                x: ["-60%", "30%", "30%", "32%", "30%", "130%"],
              }}
              transition={{
                duration: 3.0,
                times: [0, 0.4, 0.7, 0.78, 0.82, 1],
                ease: ["easeOut", "easeInOut", "easeInOut", "easeInOut", "easeIn"],
              }}
            >
              <TruckSvg />
            </motion.div>

            {/* Speed lines (only as truck exits) */}
            <motion.div
              className="absolute right-0 bottom-20 flex flex-col gap-1.5 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 0, 0.7, 0] }}
              transition={{ duration: 3.0, times: [0, 0.7, 0.8, 0.9, 1] }}
            >
              <span className="block w-16 h-0.5 bg-primary/60 rounded-full" />
              <span className="block w-10 h-0.5 bg-primary/40 rounded-full" />
              <span className="block w-20 h-0.5 bg-primary/50 rounded-full" />
              <span className="block w-12 h-0.5 bg-primary/30 rounded-full" />
            </motion.div>

            {/* SUCCESS state */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: [0, 0, 1], scale: [0.9, 0.9, 1] }}
              transition={{ duration: 3.2, times: [0, 0.85, 1], ease: "easeOut" }}
            >
              <div className="size-16 rounded-full bg-success/15 flex items-center justify-center">
                <CheckCircle2 className="size-10 text-success" strokeWidth={2.5} />
              </div>
              <p className="text-lg font-semibold text-foreground">Parcel Sent Successfully</p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BoxSvg() {
  return (
    <svg width="90" height="90" viewBox="0 0 100 100" className="drop-shadow-lg">
      {/* Box body */}
      <rect x="15" y="40" width="70" height="50" rx="3" fill="#c89669" stroke="#8b6240" strokeWidth="1.5" />
      {/* Left flap */}
      <motion.polygon
        points="15,40 50,40 50,30 15,30"
        fill="#d8a878"
        stroke="#8b6240"
        strokeWidth="1.5"
        initial={{ rotate: -90, originX: "15px", originY: "40px" }}
        animate={{ rotate: [-90, -90, 0] }}
        transition={{ duration: 2.2, times: [0, 0.1, 0.3], ease: "easeOut" }}
        style={{ transformOrigin: "15px 40px" }}
      />
      {/* Right flap */}
      <motion.polygon
        points="50,40 85,40 85,30 50,30"
        fill="#d8a878"
        stroke="#8b6240"
        strokeWidth="1.5"
        initial={{ rotate: 90, originX: "85px", originY: "40px" }}
        animate={{ rotate: [90, 90, 0] }}
        transition={{ duration: 2.2, times: [0, 0.15, 0.35], ease: "easeOut" }}
        style={{ transformOrigin: "85px 40px" }}
      />
      {/* Tape strip */}
      <motion.rect
        x="15"
        y="38"
        height="6"
        rx="1"
        fill="#e8d8a8"
        stroke="#b89858"
        strokeWidth="0.5"
        initial={{ width: 0 }}
        animate={{ width: [0, 0, 0, 70] }}
        transition={{ duration: 2.2, times: [0, 0.35, 0.4, 0.55], ease: "easeInOut" }}
      />
      {/* Address label */}
      <rect x="35" y="55" width="30" height="20" rx="1" fill="#fff" opacity="0.85" />
      <line x1="38" y1="61" x2="62" y2="61" stroke="#999" strokeWidth="1" />
      <line x1="38" y1="65" x2="58" y2="65" stroke="#999" strokeWidth="1" />
      <line x1="38" y1="69" x2="60" y2="69" stroke="#999" strokeWidth="1" />
    </svg>
  );
}

function TruckSvg() {
  return (
    <svg width="200" height="110" viewBox="0 0 200 110" className="drop-shadow-md">
      {/* Cargo box */}
      <rect x="10" y="25" width="110" height="60" rx="4" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" strokeWidth="1" />
      {/* Cargo door split line */}
      <line x1="65" y1="30" x2="65" y2="80" stroke="hsl(var(--background))" strokeOpacity="0.5" strokeWidth="1.5" />
      {/* Door panels - close late in animation */}
      <motion.rect
        x="10"
        y="25"
        width="55"
        height="60"
        rx="4"
        fill="hsl(var(--primary))"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: [-50, -50, 10], opacity: [0, 0, 1] }}
        transition={{ duration: 3.0, times: [0, 0.65, 0.75], ease: "easeOut" }}
      />
      <motion.rect
        x="65"
        y="25"
        width="55"
        height="60"
        rx="4"
        fill="hsl(var(--primary))"
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: [50, 50, 0], opacity: [0, 0, 1] }}
        transition={{ duration: 3.0, times: [0, 0.65, 0.75], ease: "easeOut" }}
      />
      {/* Cab */}
      <path
        d="M120,40 L160,40 L180,60 L180,85 L120,85 Z"
        fill="hsl(var(--primary))"
        stroke="hsl(var(--primary))"
        strokeWidth="1"
      />
      {/* Window */}
      <path d="M128,48 L158,48 L172,62 L128,62 Z" fill="#bee3f8" opacity="0.8" />
      {/* Bumper */}
      <rect x="178" y="78" width="6" height="8" rx="1" fill="#444" />
      {/* Wheels - rotate continuously */}
      <Wheel cx={45} cy={92} />
      <Wheel cx={100} cy={92} />
      <Wheel cx={155} cy={92} />
    </svg>
  );
}

function Wheel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="9" fill="#222" />
      <circle cx={cx} cy={cy} r="4" fill="#666" />
      <motion.line
        x1={cx}
        y1={cy - 7}
        x2={cx}
        y2={cy + 7}
        stroke="#888"
        strokeWidth="1.2"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.4, repeat: Infinity, ease: "linear" }}
      />
      <motion.line
        x1={cx - 7}
        y1={cy}
        x2={cx + 7}
        y2={cy}
        stroke="#888"
        strokeWidth="1.2"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.4, repeat: Infinity, ease: "linear" }}
      />
    </g>
  );
}
