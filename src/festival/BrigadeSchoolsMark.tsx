import { cn } from '@/utils/cn';
import { CarnivalMark } from './CarnivalMark';

/**
 * The Brigade Schools institutional lockup: the seagull beside the
 * three-line THE / BRIGADE / SCHOOLS wordmark, reversed out of the school's
 * olive green.
 *
 * Built from the vector seagull the site already ships rather than a bitmap,
 * so it stays sharp on any display and re-flows at any size. The olive is
 * declared here as the SCHOOL'S OWN brand colour — it is the one place on the
 * site that is deliberately not a theme token, because an institutional mark
 * must not re-tint itself per district the way the festival branding does.
 */
export function BrigadeSchoolsMark({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The Brigade Schools"
      className={cn(
        'flex items-center gap-[6%] bg-[#8c9c50] px-[8%] py-[10%]',
        className
      )}
    >
      <CarnivalMark className="h-auto w-[38%] flex-none text-white" />
      <p className="font-body text-xl font-light uppercase leading-[1.15] tracking-[0.04em] text-white sm:text-2xl md:text-3xl">
        The
        <br />
        Brigade
        <br />
        Schools
      </p>
    </div>
  );
}
