import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import { CarnivalMark } from './CarnivalMark';

const socials = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/TheBrigade.Schools/',
    Icon: Facebook,
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/thebrigade.schools',
    Icon: Instagram,
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UCrjGGrOH85T6ZTuKiAhb0VQ',
    Icon: Youtube,
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/school/the-brigade-schools-bangalore/',
    Icon: Linkedin,
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background text-foreground">
      <div
        id="contact"
        className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-6 py-16 md:grid-cols-12 md:px-10"
      >
        <div className="md:col-span-4">
          <CarnivalMark className="h-9 w-auto text-foreground" />
          <p className="mt-4 font-body text-xs font-semibold uppercase tracking-[0.22em]">
            Flash <span className="text-primary">@</span> Brigade
          </p>
          <p className="mt-3 max-w-sm font-display text-2xl font-medium italic leading-snug text-muted-foreground">
            Namma Mia Carpisa
          </p>
        </div>
        <div className="md:col-span-3">
          <h3 className="font-body text-sm font-semibold">Visit</h3>
          <address className="mt-3 font-body text-sm not-italic leading-relaxed text-muted-foreground">
            The Brigade School @ Malleswaram
            <br />
            Brigade Gateway Enclave
            <br />
            # 26/1, Railway Parallel Road
            <br />
            Malleswaram West
            <br />
            Bangalore - 560055
          </address>
        </div>
        <div className="md:col-span-3">
          <h3 className="font-body text-sm font-semibold">Contact Us</h3>
          <p className="mt-3 font-body text-sm leading-relaxed text-muted-foreground">
            Landline:{' '}
            <a
              href="tel:+918041148397"
              className="underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              +91 80411 48397
            </a>
            <br />
            Mobile:{' '}
            <a
              href="tel:+919686669805"
              className="underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              +91 96866 69805
            </a>
            <br />
            <span className="lg:whitespace-nowrap">
              Email:{' '}
              <a
                href="mailto:bfcommunication@brigadeschools.edu.in"
                className="break-all underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                bfcommunication@brigadeschools.edu.in
              </a>
            </span>
          </p>
        </div>
        <div className="md:col-span-2">
          <h3 className="font-body text-sm font-semibold">Legal</h3>
          <ul className="mt-3 space-y-2 font-body text-sm text-muted-foreground">
            <li>
              <Link
                to="/terms"
                className="underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <Link
                to="/privacy"
                className="underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10">
          {/* id: the floating Live Updates cluster observes this row and
              recedes on mobile while it is on screen, so the icons are
              always tappable. */}
          <ul
            id="footer-socials"
            className="flex items-center gap-2"
            aria-label="The Brigade Schools on social media"
          >
            {socials.map(({ label, href, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`The Brigade Schools on ${label}`}
                  className="grid h-9 w-9 place-items-center rounded-full border border-border/70 text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
          <p className="font-body text-xs text-muted-foreground">
            © 2026 Brigade School. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
