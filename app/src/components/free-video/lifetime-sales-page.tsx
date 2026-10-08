import Image from 'next/image';
import { Fragment } from 'react';
import { SUPPORT_EMAIL } from '@/lib/free-video/copy';
import { goUrl, type PAGE_PLACEMENTS } from '@/lib/free-video/offer';
import { PRICE_BOX, SALES_PAGE, TOOL_GROUPS, type SalesTool } from '@/lib/free-video/sales-page';
import { cn } from '@/lib/utils';
import styles from './free-video.module.css';
import { OfferButton } from './offer-button';
import { DemoLoop, VideoWall } from './sales-page-media';

interface LifetimeSalesPageProps {
  /** The ClickBank vtid of this page: fvthank on the thank-you page, fvpage on /v/<token>. */
  placement: (typeof PAGE_PLACEMENTS)[number];
  token: string;
}

interface PriceBoxProps {
  href: string;
  fine: readonly string[];
}

/** The lifetime page's price box: the birthday tag, the license struck through, today's price, Add To Cart. */
function PriceBox({ href, fine }: PriceBoxProps) {
  return (
    <div className={styles.spPrice}>
      <span className={styles.spPriceTag}>{PRICE_BOX.tag}</span>
      <p className={styles.spPriceWas}>
        {PRICE_BOX.wasLabel} <s>{PRICE_BOX.was}</s>
      </p>
      <p className={styles.spPriceNow}>{PRICE_BOX.now}</p>
      <p className={styles.spPriceLine}>{PRICE_BOX.line}</p>
      <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
        {PRICE_BOX.button}
      </OfferButton>
      {fine.map((line) => (
        <p key={line} className={styles.fine}>
          {line}
        </p>
      ))}
    </div>
  );
}

interface ToolTileProps {
  tool: SalesTool;
  href: string;
}

/** One of the 12 tools: what it does, its product picture, its demo or sound samples, what it rents for elsewhere. */
function ToolTile({ tool, href }: ToolTileProps) {
  const [valueLead, valuePrice, valueTail] = SALES_PAGE.tools.value(tool.monthly);
  return (
    <article className={styles.spTool}>
      <div className={styles.spToolTop}>
        {tool.step && <span className={styles.spStep}>{tool.step}</span>}
        <span className={styles.spToolBadge}>{tool.badge}</span>
      </div>
      <h3 className={styles.spToolName}>{tool.name}</h3>
      <p className={styles.spToolText}>{tool.text}</p>
      <Image className={styles.spToolImage} src={tool.image} alt={`${tool.name} product`} width={840} height={356} sizes="(min-width: 800px) 680px, 92vw" />
      {tool.demo && <DemoLoop video={tool.demo.video} poster={tool.demo.poster} label={`${tool.name} demo`} />}
      {tool.samples && (
        <div className={styles.spSamples}>
          {tool.samples.map((sample) => (
            <div key={sample.src} className={styles.spSample}>
              <p>{sample.label}</p>
              <audio className={styles.spAudio} src={sample.src} controls preload="none" aria-label={`${tool.name}: ${sample.label}`} />
            </div>
          ))}
        </div>
      )}
      <div className={styles.spToolFoot}>
        <p className={styles.spToolValue}>
          {valueLead}
          <s>{valuePrice}</s>
          {valueTail}
        </p>
        <p className={styles.spToolIncluded}>{SALES_PAGE.tools.included}</p>
        <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
          {SALES_PAGE.tools.button}
        </OfferButton>
      </div>
    </article>
  );
}

/**
 * The AI Media Machine lifetime page under the finished video ad, never before it is ready (owner 2026-10-08: "it
 * should be shown only once the result is visible ... at the bottom we should show the entire offer exactly or as close
 * to what we have on the main sales page"). Copy and media in lib/free-video/sales-page.ts, which lists what differs
 * from the lifetime page. Every button opens ClickBank's checkout through /go (OfferButton fires the pixel's
 * InitiateCheckout). No hooks of its own.
 */
export function LifetimeSalesPage({ placement, token }: LifetimeSalesPageProps) {
  const href = goUrl(placement, token);
  const { hero, order, letter, stats, tools, system, highlights, steps, audience, compare, pillars, founder, pricing, own, thinking, faq, legal } = SALES_PAGE;
  return (
    <section id={SALES_PAGE.anchor} className={styles.sp} aria-labelledby="fv-sales-title">
      <div className={styles.spHero}>
        <div className={styles.wrap}>
          <p className={styles.spPill}>{hero.eyebrow}</p>
          <h2 id="fv-sales-title" className={styles.spHeroTitle}>
            {hero.title[0]}
            <br />
            {hero.title[1]}
            <span className={styles.spMark}>{hero.title[2]}</span>
            {hero.title[3]}
          </h2>
          <p className={styles.spHeroLead}>
            {hero.lead[0]}
            <strong>{hero.lead[1]}</strong>
            {hero.lead[2]}
          </p>
          <VideoWall items={hero.wall} soundOn={hero.soundOn} soundOff={hero.soundOff} previous={hero.previous} next={hero.next} />
          <p className={styles.spWideTitle}>{hero.wideTitle}</p>
          <div className={styles.spWide}>
            {hero.wide.map((item) => (
              <video key={item.video} className={styles.spWideVideo} src={item.video} poster={item.poster} controls playsInline preload="none" aria-label={item.label} />
            ))}
          </div>
          <p className={styles.spHeroNote}>{hero.wideNote}</p>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInner}>
          {order.video && (
            <>
              <p className={styles.spLead}>{order.videoTitle}</p>
              <video className={styles.spWideVideo} src={order.video.src} poster={order.video.poster} controls playsInline preload="none" aria-label={order.video.label} />
            </>
          )}
          <h2 className={styles.spTitle}>{order.title}</h2>
          <p className={styles.spLead}>{order.text}</p>
          <PriceBox href={href} fine={order.fine} />
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInner}>
          <h2 className={styles.spTitle}>{letter.title}</h2>
          <div className={styles.spLetter}>
            <p>{letter.greeting}</p>
            {letter.body.map((line, index) => (
              <p key={line} className={cn(index === 1 && styles.spStrong)}>
                {line}
              </p>
            ))}
            <p className={styles.spStrong}>{letter.signature}</p>
            <p>{letter.questionsIntro}</p>
            {letter.questions.map((item) => (
              <Fragment key={item.q}>
                <p className={styles.spQuestion}>{item.q}</p>
                <p>{item.a}</p>
              </Fragment>
            ))}
          </div>
          <div className={styles.spStats}>
            <p className={styles.spStatsTitle}>{stats.title}</p>
            <ul className={styles.spStatsList}>
              {stats.items.map((item) => (
                <li key={item.label}>
                  <span className={styles.spStatsValue}>{item.value}</span>
                  <span className={styles.spStatsLabel}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInner}>
          <p className={styles.eyebrow}>{tools.eyebrow}</p>
          <h2 className={styles.spTitle}>
            {tools.title[0]}
            <span className={styles.spAccent}>{tools.title[1]}</span>
          </h2>
          <p className={styles.spLead}>{tools.lead}</p>
          {TOOL_GROUPS.map((group) => (
            <Fragment key={group.title ?? 'first'}>
              {group.title && <h3 className={styles.spGroupTitle}>{group.title}</h3>}
              {group.tools.map((tool) => (
                <ToolTile key={tool.name} tool={tool} href={href} />
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      <div className={styles.spBand}>
        <div className={styles.spInner}>
          <p className={styles.spBandTitle}>
            {system.title[0]}
            <br />
            <span className={styles.spBandAccent}>{system.title[1]}</span>
          </p>
          <p className={styles.spBandText}>{system.text}</p>
          <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
            {system.button}
          </OfferButton>
          <p className={styles.spBandFine}>{system.fine}</p>
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInner}>
          <h2 className={styles.spTitle}>{highlights.title}</h2>
          <p className={cn(styles.spLead, styles.spStrong)}>{highlights.lead}</p>
          <p className={styles.spLead}>{highlights.more}</p>
          <p className={styles.spLead}>{highlights.credits}</p>
          <PriceBox href={href} fine={[highlights.fine]} />
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInnerWide}>
          <p className={styles.eyebrow}>{steps.eyebrow}</p>
          <h2 className={styles.spTitle}>{steps.title}</h2>
          <ol className={styles.spSteps}>
            {steps.items.map((step, index) => (
              <li key={step.title} className={styles.spStepItem}>
                <span className={styles.spStepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={styles.spStepTitle}>{step.title}</h3>
                <p className={styles.spStepText}>{step.text}</p>
              </li>
            ))}
          </ol>
          <p className={styles.spClose}>{steps.close}</p>
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInnerWide}>
          <p className={styles.eyebrow}>{audience.eyebrow}</p>
          <h2 className={styles.spTitle}>
            {audience.title[0]}
            <br />
            <span className={styles.spAccent}>{audience.title[1]}</span>
          </h2>
          <div className={styles.spWho}>
            {audience.items.map((item) => (
              <div key={item.title} className={styles.spWhoItem}>
                <Image className={styles.spWhoImage} src={item.image} alt={item.alt} width={800} height={446} sizes="(min-width: 900px) 480px, 92vw" />
                <div className={styles.spWhoBody}>
                  <h3 className={styles.spWhoTitle}>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInnerWide}>
          <p className={styles.eyebrow}>{compare.eyebrow}</p>
          <h2 className={styles.spTitle}>
            {compare.title[0]}
            <br />
            <span className={styles.spAccent}>{compare.title[1]}</span>
          </h2>
          <p className={styles.spLead}>{compare.lead}</p>
          <div className={styles.spCompare}>
            <div className={styles.spCompareOld}>
              <h3 className={styles.spCompareTitle}>{compare.oldTitle}</h3>
              <ul className={styles.spCrosses}>
                {compare.old.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className={styles.spCompareNew}>
              <h3 className={styles.spCompareTitle}>{compare.newTitle}</h3>
              <ul className={styles.ticks}>
                {compare.new.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className={styles.spClose}>{compare.close}</p>
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInnerWide}>
          <div className={styles.spPillars}>
            {pillars.items.map((item) => (
              <div key={item.title} className={styles.spPillar}>
                <h3 className={styles.spPillarTitle}>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <div className={styles.spCta}>
            <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
              {pillars.button}
            </OfferButton>
            <p className={styles.fine}>{pillars.fine}</p>
          </div>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInnerWide}>
          <p className={styles.eyebrow}>{founder.eyebrow}</p>
          <h2 className={styles.spTitle}>
            {founder.title[0]}
            <br />
            {founder.title[1]}
            <br />
            <span className={styles.spAccent}>{founder.title[2]}</span>
          </h2>
          <div className={styles.spFounder}>
            <div className={styles.spFounderSide}>
              <Image className={styles.spFounderPhoto} src={founder.photo} alt={founder.name} width={1920} height={1080} sizes="280px" />
              <p className={styles.spFounderName}>{founder.name}</p>
              <p className={styles.spFounderRole}>{founder.role}</p>
              <p className={styles.spFounderLinks}>
                {founder.links.map((link) => (
                  <a key={link.href} className={styles.link} href={link.href} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                ))}
              </p>
            </div>
            <div className={styles.spLetter}>
              {founder.story.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <blockquote className={styles.spQuote}>&ldquo;{founder.quote}&rdquo;</blockquote>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInner}>
          <p className={styles.eyebrow}>{pricing.eyebrow}</p>
          <h2 className={styles.spTitle}>{pricing.title}</h2>
          <div className={styles.spLetter}>
            {pricing.letter.map((item) => (
              <p key={item.text}>
                {item.lead && <strong>{item.lead} </strong>}
                {item.text}
              </p>
            ))}
          </div>
          <div className={styles.spPlan}>
            <p className={styles.spPlanEyebrow}>{pricing.boxEyebrow}</p>
            <h3 className={styles.spPlanTitle}>{pricing.boxTitle}</h3>
            <p className={styles.spPlanText}>{pricing.boxText}</p>
            <PriceBox href={href} fine={[]} />
            <p className={styles.spPlanListsTitle}>{pricing.listsTitle}</p>
            <div className={styles.spPlanLists}>
              {pricing.lists.map((list) => (
                <div key={list.title}>
                  <h4 className={styles.spPlanListTitle}>{list.title}</h4>
                  <ul className={styles.ticks}>
                    {list.items.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
              {pricing.button}
            </OfferButton>
            <p className={styles.fine}>{pricing.fine}</p>
          </div>
          <p className={styles.spMore}>
            <strong>{pricing.more[0]}</strong>
            {pricing.more[1]}
          </p>
          <div className={styles.offerGuarantee}>
            <span className={styles.offerSeal} aria-hidden="true">
              30
            </span>
            <div>
              <h3 className={styles.spPillarTitle}>{pricing.guaranteeTitle}</h3>
              {pricing.guarantee.map((line, index) => (
                <p key={line} className={cn(index === 1 && styles.spStrong)}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInner}>
          <h2 className={styles.spTitle}>
            {own.title[0]}
            <br />
            <span className={styles.spAccent}>{own.title[1]}</span>
          </h2>
          <p className={styles.spLead}>{own.lead}</p>
          <div className={styles.spOwn}>
            <ul className={styles.valueList}>
              {own.rows.map((row) => (
                <li key={row.name}>
                  <span>✓ {row.name}</span>
                  <span className={styles.valuePrice}>{row.price}</span>
                </li>
              ))}
            </ul>
            <p className={styles.spOwnCredits}>{own.credits}</p>
            <dl className={styles.valueTotals}>
              {own.totals.map((row, index) => (
                <div key={row.label} className={cn(styles.valueTotal, index === own.totals.length - 1 && styles.valueToday)}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className={styles.spGrab}>
            {own.grab[0]}
            <br />
            <span className={styles.spGrabBig}>{own.grab[1]}</span>
          </p>
          <div className={styles.spCta}>
            <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
              {own.button}
            </OfferButton>
          </div>
        </div>
      </div>

      <div className={styles.spBlock}>
        <div className={styles.spInner}>
          <h2 className={styles.spTitle}>{thinking.title}</h2>
          <div className={styles.spLetter}>
            {thinking.body.map((line, index) => (
              <p key={line} className={cn(index === thinking.body.length - 1 && styles.spStrong)}>
                {line}
              </p>
            ))}
          </div>
          <div className={styles.spCta}>
            <OfferButton className={cn(styles.btn, styles.spBtn)} href={href}>
              {thinking.button}
              <span className={styles.spBtnLine}>{thinking.buttonLine}</span>
            </OfferButton>
            <p className={styles.fine}>{thinking.fine}</p>
            <ul className={styles.spTrust}>
              {thinking.trust.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className={styles.fine}>{thinking.secure}</p>
          </div>
        </div>
      </div>

      <div className={cn(styles.spBlock, styles.spSoft)}>
        <div className={styles.spInner}>
          <h2 className={styles.spTitle}>{faq.title}</h2>
          <div className={styles.faq}>
            {faq.items.map((item) => (
              <details key={item.q} className={styles.faqItem}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.spLegal}>
        <div className={styles.spInner}>
          <p>{legal.income}</p>
          <p>
            {legal.support[0]}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            {legal.support[1]}
            <a href={legal.clickbankUrl} target="_blank" rel="noopener noreferrer">
              {legal.support[2]}
            </a>
            {legal.support[3]}
          </p>
          {legal.notes.map((line) => (
            <p key={line.slice(0, 40)}>{line}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
