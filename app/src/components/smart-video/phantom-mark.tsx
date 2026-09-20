import { cn } from '@/lib/utils';

interface PhantomMarkProps {
  className?: string;
  /** While the Phantom works, the eye in the dark slowly brightens and fades. */
  active?: boolean;
}

/**
 * The Phantom's mark: half a sculpted face, one burning eye, and a second eye
 * barely visible in the dark. Drawn on its own dark tile because the darkness
 * is part of the mark.
 */
export function PhantomMark({ className, active = false }: PhantomMarkProps) {
  return (
    <svg viewBox="0 0 1024 1024" role="img" aria-label="The Phantom" className={cn('rounded-[18%]', className)}>
      <rect width="1024" height="1024" fill="#0F1116" />

      {/* the lit half of the face, plane by plane */}
      <path d="M512 68 C400 72 330 120 300 170 L310 350 L486 470 L512 480 Z" fill="#2E3340" />
      <path d="M300 170 C262 222 240 300 228 380 L222 440 L256 385 L310 350 Z" fill="#262B36" />
      <path d="M222 440 L230 500 L358 640 L410 885 L512 955 L512 480 L486 470 L478 487 L362 560 L256 385 Z" fill="#2B303C" />
      <path d="M230 500 L262 580 L290 710 L410 885 L358 640 Z" fill="#232731" />
      <path d="M362 560 L478 487 L486 470 L462 512 Z" fill="#1E222B" />
      <path d="M256 385 L310 350 L486 470 L478 487 Z" fill="#20242E" />

      {/* the burning eye */}
      <path d="M256 385 L478 487 C420 515 330 505 286 450 Z" fill="#F5A623" />
      <path d="M256 385 L478 487 C440 492 330 455 270 410 Z" fill="#C4821A" />

      {/* the eye in the dark */}
      <g className={cn(active && 'animate-pulse')} opacity={active ? 1 : 0.42}>
        <path d="M768 385 L546 487 C604 515 694 505 738 450 Z" fill="#B87A17" />
        <path d="M768 385 L546 487 C584 492 694 455 754 410 Z" fill="#8A5B12" />
      </g>
    </svg>
  );
}
