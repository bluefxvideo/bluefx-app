import type { Metadata } from 'next';
import styles from '@/components/free-video/free-video.module.css';
import { FreeVideoLanding } from '@/components/free-video/free-video-landing';
import { AdCarousel, ResultPreview, StartHere, StickyBar, WebsiteForm } from '@/components/free-video/landing-parts';
import { EXAMPLES, FAQ, LANDING, PAGE_META, PROOF } from '@/lib/free-video/copy';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: PAGE_META.landingTitle,
  description: LANDING.sub,
  openGraph: { title: LANDING.h1, description: LANDING.sub, type: 'website' },
};

/**
 * The landing page (v8, owner 2026-10-06: "look at how Neil Patel is doing this with a free tool"): one
 * light card with a small label, the promise, one website field with a "Start here!" note pointing at it,
 * then the 3 numbered steps beside a result card that plays the silent reel; below it the proof strip,
 * the examples, the questions and the bottom form (credibility pass, owner 2026-10-06). Name and email come in
 * step 2. No watermark and no price on this page (owner 2026-10-06), and no picture of the owner ("take me
 * out of the scene for now"). Static: no auth, no database read, and the ?ref= tag is read in the browser.
 */
export default function FreeVideoAdPage() {
  return (
    <FreeVideoLanding>
      <section className={styles.toolHero} aria-labelledby="fv-hero-title">
        <div className={styles.toolCard}>
          <p className={styles.pill}>{LANDING.pill}</p>
          <h1 id="fv-hero-title" className={styles.toolTitle}>
            {LANDING.h1}
          </h1>
          <p className={styles.toolSub}>{LANDING.sub}</p>
          <div className={styles.formRow}>
            <StartHere />
            <WebsiteForm form="top" />
          </div>
          <ul className={styles.toolTrust}>
            {LANDING.trust.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <div className={styles.toolGrid}>
            <ol className={styles.numSteps}>
              {LANDING.steps.map((step, index) => (
                <li key={step.title} className={styles.numStep}>
                  <span className={styles.num} aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className={styles.numTitle}>{step.title}</h2>
                    <p className={styles.numText}>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ResultPreview />
          </div>
        </div>
      </section>

      <section className={styles.proof} aria-label={PROOF.lead}>
        <p className={styles.proofLead}>{PROOF.lead}</p>
        <ul className={styles.proofStats}>
          {PROOF.stats.map((stat) => (
            <li key={stat.label} className={styles.proofStat}>
              <span className={styles.proofValue}>{stat.value}</span>
              <span className={styles.proofLabel}>{stat.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.sectionWhite} aria-labelledby="fv-examples-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>{EXAMPLES.eyebrow}</p>
          <h2 id="fv-examples-title" className={styles.sectionTitle}>
            {EXAMPLES.heading}
          </h2>
          <p className={styles.lead}>{EXAMPLES.lead}</p>
          <AdCarousel />
          <p className={styles.madeFor}>{EXAMPLES.madeFor}</p>
        </div>
      </section>

      <section className={styles.sectionLight} aria-labelledby="fv-faq-title">
        <div className={cn(styles.wrap, styles.narrow)}>
          <p className={styles.eyebrow}>{FAQ.eyebrow}</p>
          <h2 id="fv-faq-title" className={styles.sectionTitle}>
            {FAQ.heading}
          </h2>
          <div className={styles.faq}>
            {FAQ.items.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={cn(styles.hero, styles.heroBottom)} aria-labelledby="fv-bottom-title">
        <div className={styles.wrap}>
          <h2 id="fv-bottom-title" className={cn(styles.sectionTitle, styles.onBlue)}>
            {LANDING.bottomHeading}
          </h2>
          <WebsiteForm form="bottom" />
        </div>
      </section>

      <StickyBar />
    </FreeVideoLanding>
  );
}
