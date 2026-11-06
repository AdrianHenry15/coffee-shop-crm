import Link from "next/link"

type Props = {
  title: string
  sections: {
    title: string
    paragraphs: string[]
  }[]
}

export function LegalPage({ title, sections }: Props) {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <article className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-4">
          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline">
            ← CoffeeShopCRM
          </Link>

          <h1 className="font-mono text-3xl font-semibold">{title}</h1>

          <p className="text-sm text-muted">Version: November 3, 2026</p>

          <p className="text-sm leading-relaxed text-muted">
            CoffeeShopCRM is operated by Third Generation Studios. Questions?{" "}
            <a
              href="mailto:ahenry@thirdgenerationstudios.com"
              className="text-primary hover:underline">
              ahenry@thirdgenerationstudios.com
            </a>
          </p>
        </header>

        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-lg font-semibold">{section.title}</h2>

            {section.paragraphs.map((paragraph, index) => (
              <p key={index} className="text-sm leading-7 text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <footer className="flex gap-5 border-t border-border pt-6 text-sm">
          <Link href="/terms" className="text-primary hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy
          </Link>
        </footer>
      </article>
    </main>
  )
}
