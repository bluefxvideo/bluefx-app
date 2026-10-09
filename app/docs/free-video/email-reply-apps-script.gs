/**
 * Free video ad — email-reply campaign (Google Apps Script, runs inside the support@bluefx.net Gmail account).
 *
 * The broadcast "Can I make you a video?" goes out from MailerLite with Reply-To support@bluefx.net.
 * Every minute this script:
 *   1. finds reply threads to that subject it has not handled yet,
 *   2. posts the newest reply to https://app.bluefx.net/api/free-video/inbound,
 *   3. answers in the same thread with the text the app returns (the link to watch the video being made),
 *   4. labels the thread "free-video-done" so it is never handled twice.
 * Replies with no website (or anything the app chooses not to answer) stay in the inbox for Szilard.
 *
 * Setup: see email-reply-campaign.md next to this file. The script holds no secret: it proves it runs as
 * support@bluefx.net with Google's identity token (needs the appsscript.json scopes in this folder).
 */

const SUBJECT = 'Can I make you a video?';               // the broadcast subject, exactly as sent
const CAMPAIGN = 'video-email-1';                        // shows as the lead's ref in the admin panel
const ENDPOINT = 'https://app.bluefx.net/api/free-video/inbound';
const OUR_ADDRESSES = ['support@bluefx.net', 'contact@bluefx.net'];
const DONE_LABEL = 'free-video-done';

function processReplies() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // the previous run is still busy
  try {
    const done = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
    const query = `subject:"${SUBJECT}" -label:${DONE_LABEL} newer_than:14d -from:me`;
    const threads = GmailApp.search(query, 0, 40);
    for (const thread of threads) {
      const messages = thread.getMessages();
      // The newest message someone else sent (skip our own answers in the thread).
      const reply = messages
        .slice()
        .reverse()
        .find((m) => !OUR_ADDRESSES.some((a) => m.getFrom().toLowerCase().includes(a)));
      if (!reply) {
        thread.addLabel(done);
        continue;
      }
      const res = UrlFetchApp.fetch(`${ENDPOINT}?ref=${encodeURIComponent(CAMPAIGN)}`, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: `Bearer ${ScriptApp.getIdentityToken()}` },
        payload: JSON.stringify({ from: reply.getFrom(), subject: reply.getSubject(), text: reply.getPlainBody() }),
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();
      if (code === 401) throw new Error('The app refused this account: run the script as support@bluefx.net.');
      let data = {};
      try {
        data = JSON.parse(res.getContentText());
      } catch (e) {
        console.warn(`Unreadable answer (${code}) for ${reply.getFrom()}; will retry next minute.`);
        continue;
      }
      if (!data.ok) {
        console.warn(`App error for ${reply.getFrom()}; will retry next minute.`);
        continue;
      }
      if (data.reply) reply.reply(data.reply, { htmlBody: toHtml(data.reply) });
      thread.addLabel(done);
      console.log(`${reply.getFrom()} → ${data.action}${data.domain ? ' (' + data.domain + ')' : ''}`);
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * The answer as simple HTML, so Gmail does not hard-wrap long lines (plain text breaks at ~76 characters).
 * Blank line = new paragraph, single line break kept, links clickable.
 */
function toHtml(text) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((p) => '<p>' + esc(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>') + '</p>')
    .join('');
}

/** Run once by hand: authorizes Gmail access and starts the every-minute schedule. */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'processReplies')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processReplies').timeBased().everyMinutes(1).create();
  processReplies();
}

/** Run by hand to stop the campaign. */
function stop() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
}
