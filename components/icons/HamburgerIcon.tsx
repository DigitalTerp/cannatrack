import React from 'react';

export default function HamburgerIcon({
  open = false,
  size = 24,
  strokeWidth = 2,
  className,
}: {
  open?: boolean;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  // Uses currentColor so it inherits button/text color
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`icon-hamburger ${open ? 'is-open' : ''} ${className ?? ''}`}
    >
      <line x1="4" y1="7"  x2="20" y2="7"  className="bar bar-top" />
      <line x1="4" y1="12" x2="20" y2="12" className="bar bar-mid" />
      <line x1="4" y1="17" x2="20" y2="17" className="bar bar-bot" />
    </svg>
  );
}
