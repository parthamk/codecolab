import React, { useMemo, useState } from 'react';

const NEON_COLORS = [
  ['#9b30ff', '#6010d0'],
  ['#ff30a0', '#c0006a'],
  ['#30cfff', '#0090c0'],
  ['#30ff90', '#009050'],
  ['#ff9030', '#c05000'],
  ['#ff3060', '#a00030'],
  ['#c0ff30', '#709000'],
  ['#30a0ff', '#0060c0'],
];

function getColorPair(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NEON_COLORS[Math.abs(hash) % NEON_COLORS.length];
}

function Client({ username }) {
  const [hovered, setHovered] = useState(false);
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  const [from, to] = useMemo(() => getColorPair(username || ''), [username]);

  return (
    <div
      className="client-wrapper"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="client-avatar"
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
          boxShadow: hovered ? `0 0 14px ${from}99` : `0 0 6px ${from}55`,
        }}
      >
        {initial}
      </div>

      {hovered && (
        <div className="client-tooltip">
          {username}
          <div className="client-tooltip-arrow" />
        </div>
      )}
    </div>
  );
}

export default Client;
