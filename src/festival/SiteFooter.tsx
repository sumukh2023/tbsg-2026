export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background text-foreground">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-12 md:px-10">
        <div className="md:col-span-6">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.22em]">
            Flash <span className="text-primary">@</span> Brigade
          </p>
          <p className="mt-4 max-w-sm font-display text-2xl font-medium italic leading-snug text-muted-foreground">
            Namma Mia Carpisa
          </p>
        </div>
        <div className="md:col-span-3">
          <h3 className="font-body text-sm font-semibold">Visit</h3>
          <address className="mt-3 font-body text-sm not-italic leading-relaxed text-muted-foreground">
            The Brigade School @ Malleswaram
            <br />
            5th Main Road, Malleswaram
            <br />
            Bengaluru 560003
          </address>
        </div>
        <div className="md:col-span-3">
          <h3 className="font-body text-sm font-semibold">Write</h3>
          <p className="mt-3 font-body text-sm leading-relaxed text-muted-foreground">
            <a
              href="mailto:flash@thebrigadeschool.edu.in"
              className="underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              flash@thebrigadeschool.edu.in
            </a>
            <br />
            Festival desk, main gate, on the day
          </p>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 font-body text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
          <p>
            Organised entirely by the students of The Brigade School @
            Malleswaram.
          </p>
          <p>© 2026 Flash @ Brigade</p>
        </div>
      </div>
    </footer>
  );
}
