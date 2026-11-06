export default function LatticeRibbon() {
  return (
    <svg
      className="lattice-ribbon"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ribbonBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00A6D6" />
          <stop offset="100%" stopColor="#00698F" />
        </linearGradient>
        <linearGradient id="ribbonTeal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#27C7B7" />
          <stop offset="100%" stopColor="#008E92" />
        </linearGradient>
        <linearGradient id="ribbonGreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A1CF43" />
          <stop offset="100%" stopColor="#288A59" />
        </linearGradient>
      </defs>

      {/* Top-right blue band */}
      <path
        d="M 1370 -170 C 1220 -40, 1110 100, 1010 280 S 850 570, 650 760"
        fill="none"
        stroke="url(#ribbonBlue)"
        strokeWidth="175"
        strokeLinecap="butt"
      />

      {/* Green band crossing the top-right */}
      <path
        d="M 1740 -80 C 1500 0, 1370 180, 1260 370 S 1120 600, 940 850"
        fill="none"
        stroke="url(#ribbonGreen)"
        strokeWidth="155"
        strokeLinecap="butt"
      />

      {/* Large sweeping teal ribbon */}
      <path
        d="M 1750 380 C 1480 470, 1350 690, 1110 790 S 660 940, 350 1080"
        fill="none"
        stroke="url(#ribbonTeal)"
        strokeWidth="185"
        strokeLinecap="butt"
      />

      {/* Deep-blue lower ribbon */}
      <path
        d="M 1710 560 C 1430 650, 1340 820, 1050 900 S 590 1040, 250 1140"
        fill="none"
        stroke="#006B91"
        strokeWidth="145"
        strokeLinecap="butt"
        opacity="0.97"
      />

      {/* Translucent crossing highlight */}
      <path
        d="M 1680 195 C 1440 300, 1310 490, 1130 660"
        fill="none"
        stroke="#67D0C4"
        strokeWidth="72"
        opacity="0.32"
      />
    </svg>
  );
}
