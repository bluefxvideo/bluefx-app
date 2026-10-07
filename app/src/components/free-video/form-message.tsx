import { NEXT_STEPS } from '@/lib/free-video/copy';
import { nextStepHref, type FormProblem } from './form-errors';
import styles from './free-video.module.css';

interface FormMessageProps {
  problem: FormProblem;
  /** What the visitor typed as the website; it goes into the resend email's body. */
  website: string;
  id?: string;
  /**
   * 'field': red text under a field. 'box': a light red box (on the blue band and above the send button).
   * 'note': a light grey box, for a refusal that is no mistake (one free video ad per business).
   */
  variant: 'field' | 'box' | 'note';
}

/** One form message plus its next step (a mailto link to support), announced to screen readers when it appears. */
export function FormMessage({ problem, website, id, variant }: FormMessageProps) {
  const next = problem.nextStep;
  return (
    <div id={id} role="alert" className={variant === 'box' ? styles.formAlert : variant === 'note' ? styles.formNote : styles.fieldError}>
      <p className={styles.messageText}>{problem.message}</p>
      {next === 'resend' && (
        <p className={styles.nextStep}>
          {NEXT_STEPS.resendLead}{' '}
          <a className={styles.link} href={nextStepHref('resend', website)}>
            {NEXT_STEPS.resendLink}
          </a>
        </p>
      )}
      {next === 'noWebsite' && (
        <p className={styles.nextStep}>
          {NEXT_STEPS.noWebsiteLead}{' '}
          <a className={styles.link} href={nextStepHref('noWebsite', website)}>
            {NEXT_STEPS.noWebsiteLink}
          </a>
          {NEXT_STEPS.noWebsiteAfter}
        </p>
      )}
    </div>
  );
}
