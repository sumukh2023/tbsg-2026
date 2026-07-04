import { cn } from '@/utils/cn';

/**
 * The Brigade School seagull, recreated as a vector mark from the carnival
 * logo. Fills with currentColor so it reads as ink on the marble day theme
 * and marble on the evening theme.
 */
export function CarnivalMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="40 20 660 360"
      aria-hidden="true"
      className={cn('fill-current', className)}
    >
      <path
        d="M 60 62
        C 160 36 268 56 342 104
        C 372 118 402 124 436 118
        C 468 110 490 100 506 98
        C 522 90 542 88 557 94
        L 536 106
        C 528 116 522 122 518 126
        C 542 132 566 142 588 156
        C 642 190 674 264 687 368
        C 662 318 622 280 572 258
        C 542 246 506 243 472 249
        C 434 256 404 270 380 291
        L 332 305
        C 340 288 346 278 352 270
        L 288 298
        C 300 276 318 258 340 247
        C 300 236 250 205 200 168
        C 152 132 100 94 60 62
        Z"
      />
    </svg>
  );
}
