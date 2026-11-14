/**
 * Offline checks for the ClickBank affiliate funnel's sale (lib/free-video/clickbank-video-ad.ts, offer.ts CB_UNLOCK,
 * docs/cb-affiliate-funnel.md §3 and §5): the readers of both zaps' posts, the receipt, the transaction types, the seller
 * variables, the item-12 branch's 'only' / 'mixed' / null, ClickBank's order API answer, the order link, and that
 * garbage never throws. No database, no network: fetch fails loudly here and is never called by what is checked.
 *
 * Run from app/:  npx tsx src/scripts/cb-funnel-sale-checks.ts
 */

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
}

const show = (value: unknown) => JSON.stringify(value);

async function main() {
  // Nothing checked here may reach the network.
  globalThis.fetch = (async () => {
    throw new Error('cb-funnel-sale-checks: no network allowed');
  }) as typeof fetch;

  const cb = await import('@/lib/free-video/clickbank-video-ad');
  const offer = await import('@/lib/free-video/offer');

  // A view token with both '-' and '_' (base64url, 22 characters).
  const TOKEN = 'q2-Hs_8LmZ0aBcDeFgHiJk';
  const LEAD_ID = '1a2b3c4d-5e6f-4a1b-9c2d-0123456789ab';
  check('the test token has the token shape', /^[A-Za-z0-9_-]{22}$/.test(TOKEN) && TOKEN.includes('-') && TOKEN.includes('_'));

  console.log('== zap A (thin JSON)');
  const zapA = {
    transaction_type: 'SALE',
    receipt: 'ABCD1234',
    itemNo: '12',
    vendor: 'bluefx02',
    customer_email: 'Buyer@Example.com ',
    customer_first_name: 'Ann',
    amount: '49.00',
    affiliate: 'nick_1',
  };
  const a = cb.readClickBankVideoAdPost(zapA);
  check('receipt', a.receipt === 'ABCD1234', show(a.receipt));
  check('a sale, not a test', a.kind === 'sale' && !a.test && a.transactionType === 'SALE', show([a.kind, a.test, a.transactionType]));
  check('item 12', show(a.items) === show(['12']), show(a.items));
  check('vendor bluefx02', a.vendor === 'bluefx02', show(a.vendor));
  check('email lowercased and trimmed', a.email === 'buyer@example.com', show(a.email));
  check('affiliate kept', a.affiliate === 'nick_1', show(a.affiliate));
  check('zap A', a.zap === 'A', a.zap);
  check('no token, no vtid, no lead prefix', a.fvt === null && a.vtid === null && a.leadPrefix === null && a.trackingId === null, show([a.fvt, a.vtid, a.leadPrefix, a.trackingId]));
  check('amount kept as text', a.amount === '49.00', show(a.amount));
  check("branch: 'only'", cb.clickBankVideoAdIn(zapA) === 'only');

  console.log('== zap B (full trigger payload)');
  const vendorVariables = JSON.stringify({
    item: [
      { name: 'cbitems', value: '12' },
      { name: 'vtid', value: 'fvcb49_1a2b3c4d' },
      { name: 'fvt', value: TOKEN },
    ],
  });
  const zapB = {
    transactionType: 'SALE',
    receipt: 'abcd1234__2_ACTIVE',
    vendor: 'BlueFX02',
    email: 'buyer@example.com',
    firstName: 'Ann',
    lineItemData: JSON.stringify([{ itemNo: '12', productTitle: 'AI Video Ad', accountAmount: '20.15', customerAmount: '49.00' }]),
    vendorVariables,
    trackingId: 'fvcb49_1a2b3c4d',
    totalOrderAmount: '52.43',
    country: 'US',
  };
  const b = cb.readClickBankVideoAdPost(zapB);
  check("receipt 'abcd1234__2_ACTIVE' → 'ABCD1234'", b.receipt === 'ABCD1234' && b.rawReceipt === 'abcd1234__2_ACTIVE', show([b.receipt, b.rawReceipt]));
  check('zap B', b.zap === 'B', b.zap);
  check('vendor lowercased', b.vendor === 'bluefx02', show(b.vendor));
  check('item 12 from lineItemData and cbitems, once', show(b.items) === show(['12']), show(b.items));
  check('fvt from vendorVariables', b.fvt === TOKEN, show(b.fvt));
  check('vtid from vendorVariables', b.vtid === 'fvcb49_1a2b3c4d', show(b.vtid));
  check('lead prefix from the vtid', b.leadPrefix === '1a2b3c4d', show(b.leadPrefix));
  check('item-12 line amounts', b.accountAmount === '20.15' && b.customerAmount === '49.00' && b.totalOrderAmount === '52.43', show([b.accountAmount, b.customerAmount, b.totalOrderAmount]));
  check('country', b.country === 'US', show(b.country));
  check("branch: 'only'", cb.clickBankVideoAdIn(zapB) === 'only');

  console.log('== seller variables in other shapes');
  const single = cb.readClickBankVideoAdPost({ ...zapB, vendorVariables: JSON.stringify({ item: { name: 'fvt', value: TOKEN } }) });
  check('item as a single object (JSON string)', single.fvt === TOKEN, show(single.fvt));
  const singleObject = cb.readClickBankVideoAdPost({ ...zapB, vendorVariables: { item: { name: 'FVT', value: TOKEN } } });
  check('item as a single object (object, name in capitals)', singleObject.fvt === TOKEN, show(singleObject.fvt));
  const listObject = cb.readClickBankVideoAdPost({ ...zapB, vendorVariables: { item: [{ name: 'fvt', value: TOKEN }, { name: 'vtid', value: 'fvcb49_9f8e7d6c' }] } });
  check('item as a list (object)', listObject.fvt === TOKEN && listObject.vtid === 'fvcb49_9f8e7d6c', show([listObject.fvt, listObject.vtid]));
  const python = cb.readClickBankVideoAdPost({ ...zapB, vendorVariables: `{'item': [{'name': 'fvt', 'value': '${TOKEN}'}, {'name': 'vtid', 'value': 'fvcb49_1a2b3c4d'}]}` });
  check("Python's print (single quotes)", python.fvt === TOKEN && python.vtid === 'fvcb49_1a2b3c4d', show([python.fvt, python.vtid]));
  const plainMap = cb.readClickBankVideoAdPost({ ...zapB, vendorVariables: JSON.stringify({ fvt: TOKEN }) });
  check('a plain {name: value} object', plainMap.fvt === TOKEN, show(plainMap.fvt));
  const badToken = cb.readClickBankVideoAdPost({ ...zapB, vendorVariables: JSON.stringify({ item: [{ name: 'fvt', value: 'too-short' }] }) });
  check('a token without the token shape is ignored', badToken.fvt === null, show(badToken.fvt));
  const garbageVars = cb.readClickBankVideoAdPost({ ...zapB, vendorVariables: '}{ not json' });
  check('garbage vendorVariables: no variables, the post still reads', garbageVars.fvt === null && garbageVars.receipt === 'ABCD1234' && show(garbageVars.items) === show(['12']), show(garbageVars));
  check('vendorVariablesOf(null) is empty', cb.vendorVariablesOf(null).size === 0);

  console.log('== trackingId');
  const nilValue = cb.readClickBankVideoAdPost({ ...zapA, trackingId: '@nil' });
  check("trackingId '@nil' is no tracking id", nilValue.trackingId === null && nilValue.leadPrefix === null, show(nilValue.trackingId));
  const nilKey = cb.readClickBankVideoAdPost({ ...zapA, 'trackingId__@nil': 'true' });
  check('the key trackingId__@nil is no tracking id', nilKey.trackingId === null, show(nilKey.trackingId));
  const nilObject = cb.readClickBankVideoAdPost({ ...zapA, trackingId: { '@nil': 'true' } });
  check("trackingId {'@nil': 'true'} is no tracking id", nilObject.trackingId === null, show(nilObject.trackingId));
  const tracked = cb.readClickBankVideoAdPost({ ...zapA, trackingId: 'FVCB49_1A2B3C4D' });
  check('the vtid in trackingId gives the lead prefix (any case)', tracked.leadPrefix === '1a2b3c4d', show(tracked.leadPrefix));
  const aimmTag = cb.readClickBankVideoAdPost({ ...zapA, trackingId: 'fvres1_1a2b3c4d' });
  check('an AI Media Machine vtid gives no lead prefix here', aimmTag.leadPrefix === null, show(aimmTag.leadPrefix));
  check("offer.ts leadPrefixOfVtid never reads fvcb49 (an item-12 sale is not an AI Media Machine sale)", offer.leadPrefixOfVtid('fvcb49_1a2b3c4d') === null);

  console.log('== which posts the branch takes');
  check("bluefx01 item 12 → null", cb.clickBankVideoAdIn({ ...zapA, vendor: 'bluefx01' }) === null);
  check("bluefx02 item 1 → null", cb.clickBankVideoAdIn({ ...zapA, itemNo: '1' }) === null);
  check('no vendor → null', cb.clickBankVideoAdIn({ ...zapA, vendor: undefined }) === null);
  check("vendor in 'account' counts", cb.clickBankVideoAdIn({ ...zapA, vendor: undefined, account: 'BLUEFX02' }) === 'only');
  check("item 12 + item 1 (flat, comma list) → 'mixed'", cb.clickBankVideoAdIn({ ...zapA, itemNo: '12,1' }) === 'mixed');
  check(
    "item 12 + item 1 (lineItemData) → 'mixed'",
    cb.clickBankVideoAdIn({ ...zapB, vendorVariables: undefined, lineItemData: JSON.stringify([{ itemNo: '12' }, { itemNo: '1' }]) }) === 'mixed'
  );
  check("lineItemData as an array (not a string) → 'only'", cb.clickBankVideoAdIn({ ...zapB, lineItemData: [{ itemNo: '12' }] }) === 'only');
  check("lineItemData as one object string → 'only'", cb.clickBankVideoAdIn({ ...zapB, lineItemData: JSON.stringify({ itemNo: '12' }) }) === 'only');
  const pythonLines = cb.readClickBankVideoAdPost({ ...zapB, vendorVariables: undefined, lineItemData: "[{'itemNo': '12', 'productTitle': 'Bob's ad', 'recurring': False, 'shippable': None}]" });
  check("Python lineItemData with an apostrophe in the title still gives item 12", show(pythonLines.items) === show(['12']), show(pythonLines.items));
  check("Zapier's flat lineItemData__itemNo key counts", cb.clickBankVideoAdIn({ vendor: 'bluefx02', receipt: 'ABCD1234', transactionType: 'SALE', lineItemData__itemNo: '12' }) === 'only');
  check("TEST_SALE item 12 → 'only' (the branch handles test purchases too)", cb.clickBankVideoAdIn({ ...zapA, transaction_type: 'TEST_SALE' }) === 'only');
  check('an AI Media Machine sale is left alone', cb.clickBankVideoAdIn({ transactionType: 'SALE', receipt: 'ZZZZ9999', vendor: 'bluefx02', lineItemData: JSON.stringify([{ itemNo: '1' }]), trackingId: 'fvres1_1a2b3c4d' }) === null);

  console.log('== form-encoded zap B (every value a string)');
  const form = cb.readClickBankVideoAdPost({
    transactionType: 'SALE',
    receipt: 'ABCD1234',
    vendor: 'bluefx02',
    customer: '{"email":"Form@Example.com","firstName":"Ann"}',
    lineItemData: "[{'itemNo': '12'}]",
    vendorVariables: `{'item': {'name': 'fvt', 'value': '${TOKEN}'}}`,
  });
  check('customer as a JSON string gives the email', form.email === 'form@example.com', show(form.email));
  check('item and token read from strings', show(form.items) === show(['12']) && form.fvt === TOKEN, show([form.items, form.fvt]));

  console.log('== receipts');
  check("'ABCD1234__2_ACTIVE' → 'ABCD1234'", cb.normaliseReceipt('ABCD1234__2_ACTIVE') === 'ABCD1234');
  check('lower case and spaces', cb.normaliseReceipt('  xyz789ab ') === 'XYZ789AB');
  check('a number', cb.normaliseReceipt(12345678) === '12345678');
  check('empty, nil and odd characters → null', [null, undefined, '', '@nil', 'bad receipt!', '<script>', {}, []].every((value) => cb.normaliseReceipt(value) === null));
  check('the routes take a receipt with or without the suffix', cb.CB_RECEIPT_PATTERN.test('ABCD1234') && cb.CB_RECEIPT_PATTERN.test('ABCD1234__2_ACTIVE') && cb.CB_RECEIPT_PATTERN.test('abcd1234'));
  check('the routes refuse anything else', !['abc', 'ABCD 1234', '<script>', 'ABCD1234__', 'A'.repeat(21), "ABCD1234'--"].some((value) => cb.CB_RECEIPT_PATTERN.test(value)));
  check('a post without a receipt reads as receipt null', cb.readClickBankVideoAdPost({ ...zapA, receipt: undefined }).receipt === null);
  check("receipt falls back to order_id like the old route's ||", cb.readClickBankVideoAdPost({ ...zapA, receipt: '', order_id: 'efgh5678' }).receipt === 'EFGH5678');

  console.log('== transaction types');
  const types: [unknown, string, boolean][] = [
    ['SALE', 'sale', false],
    ['sale', 'sale', false],
    ['TEST_SALE', 'sale', true],
    ['RFND', 'refund', false],
    ['rfnd', 'refund', false],
    [' REFUND ', 'refund', false],
    ['TEST_RFND', 'refund', true],
    ['TEST_REFUND', 'refund', true],
    ['CGBK', 'refund', false],
    ['TEST_CGBK', 'refund', true],
    ['INSF', 'refund', false],
    ['BILL', 'other', false],
    ['CANCEL-REBILL', 'other', false],
    ['UNCANCEL-REBILL', 'other', false],
    ['TEST', 'other', true],
    ['', 'other', false],
    [null, 'other', false],
    [42, 'other', false],
  ];
  for (const [raw, kind, test] of types) {
    const got = cb.cbTransactionOf(raw);
    check(`${show(raw)} → ${kind}${test ? ' (test)' : ''}`, got.kind === kind && got.test === test, show(got));
  }
  check('zap B refunds read from transactionType', cb.readClickBankVideoAdPost({ ...zapB, transactionType: 'RFND' }).kind === 'refund');

  console.log('== garbage never throws');
  const circular: Record<string, unknown> = { vendor: 'bluefx02', itemNo: '12' };
  circular.self = circular;
  const garbage: unknown[] = [
    null,
    undefined,
    42,
    'string',
    [],
    [1, 2, 3],
    true,
    { receipt: {} },
    { receipt: ['x'] },
    { lineItemData: 123 },
    { lineItemData: '{{{' },
    { lineItemData: { lineItemData: { lineItemData: { lineItemData: { lineItemData: { itemNo: '12' } } } } } },
    { vendorVariables: '}{' },
    { vendorVariables: 42 },
    { vendorVariables: { item: 'not json' } },
    { vendorVariables: { item: [null, 1, 'x', { name: {}, value: [] }] } },
    { customer: 5 },
    { customer: '{bad' },
    { transactionType: {} },
    { vendor: {}, itemNo: {} },
    { lineItemData: 'x'.repeat(200_000), vendorVariables: 'y'.repeat(200_000) },
    circular,
  ];
  let threw = '';
  for (const value of garbage) {
    try {
      const post = cb.readClickBankVideoAdPost(value);
      cb.clickBankVideoAdIn(value);
      cb.mergeCbPosts([post as unknown as Record<string, unknown>, value as Record<string, unknown>]);
      cb.readOrders2(value);
      cb.vendorVariablesOf(value);
      cb.normaliseReceipt(value);
      cb.cbTransactionOf(value);
      cb.leadPrefixOfCbVtid(value);
    } catch (error) {
      threw += `${show(String(value)).slice(0, 40)}: ${error instanceof Error ? error.message : String(error)}; `;
    }
  }
  check('no reader throws on garbage', !threw, threw);
  check("garbage is never item 12's branch", garbage.filter((value) => value !== circular).every((value) => cb.clickBankVideoAdIn(value) === null));
  check("a circular post with item 12 still reads ('only')", cb.clickBankVideoAdIn(circular) === 'only');
  check("a huge unreadable lineItemData does not hide a flat item 12 ('only')", cb.clickBankVideoAdIn({ ...zapA, lineItemData: 'x'.repeat(200_000) }) === 'only');

  console.log('== the posts of one receipt merged (the sweep)');
  const recordA = { receipt: 'ABCD1234', email: 'buyer@example.com', fvt: null, trackingId: null, vtid: null, transactionType: 'SALE', affiliate: 'nick_1' };
  const recordB = { receipt: 'ABCD1234', email: null, fvt: TOKEN, trackingId: 'fvcb49_1a2b3c4d', vtid: 'fvcb49_1a2b3c4d', transactionType: 'SALE', affiliate: null };
  const merged = cb.mergeCbPosts([recordA, recordB]);
  check('token, lead prefix, email and affiliate from either post', merged.fvt === TOKEN && merged.leadPrefix === '1a2b3c4d' && merged.email === 'buyer@example.com' && merged.affiliate === 'nick_1', show(merged));
  check('a real sale is not a test', !merged.test && show(merged.types) === show(['SALE']), show(merged));
  check('all test posts → a test purchase', cb.mergeCbPosts([{ transactionType: 'TEST_SALE' }, { transactionType: 'TEST_SALE' }]).test);
  check('no posts → nothing', (() => {
    const none = cb.mergeCbPosts([]);
    return none.fvt === null && none.email === null && none.leadPrefix === null && !none.test;
  })());

  console.log("== ClickBank's order API answer (orders2)");
  const orderOne = {
    orderData: {
      receipt: 'ABCD1234',
      transactionType: 'SALE',
      vendor: 'bluefx02',
      affiliate: 'nick_1',
      email: 'Buyer@Example.com',
      trackingId: 'fvcb49_1a2b3c4d',
      vendorVariables: { item: { name: 'fvt', value: TOKEN } },
      lineItemData: { itemNo: '12', productTitle: 'AI Video Ad', status: 'COMPLETED' },
    },
  };
  const info = cb.readOrders2(orderOne);
  check('one order object: item, vendor, email, token', Boolean(info) && show(info?.items) === show(['12']) && info?.vendor === 'bluefx02' && info?.email === 'buyer@example.com' && info?.fvt === TOKEN, show(info));
  check('it proves the sale', cb.judgeOrders2(info).verdict === 'confirmed', show(cb.judgeOrders2(info)));
  const refunded = cb.readOrders2({ orderData: [orderOne.orderData, { ...orderOne.orderData, transactionType: 'RFND' }] });
  check('a list with a refund does not prove a sale', cb.judgeOrders2(refunded).verdict === 'mismatch', show(cb.judgeOrders2(refunded)));
  check('item 1 only does not prove item 12', cb.judgeOrders2(cb.readOrders2({ orderData: { ...orderOne.orderData, lineItemData: [{ itemNo: '1' }] } })).verdict === 'mismatch');
  check("bluefx01's item 12 does not prove bluefx02's", cb.judgeOrders2(cb.readOrders2({ orderData: { ...orderOne.orderData, vendor: 'bluefx01' } })).verdict === 'mismatch');
  check('no order in the answer → not found', cb.readOrders2({}) === null && cb.judgeOrders2(null).verdict === 'not-found');
  check("an answer with @nil fields still reads", cb.readOrders2({ orderData: { ...orderOne.orderData, trackingId: { '@nil': 'true' } } })?.trackingId === null);

  console.log('== the order link and the placements');
  const link = offer.cbUnlockCheckoutUrl(TOKEN, LEAD_ID);
  check('the exact link', link === `https://bluefx02.pay.clickbank.net/?cbitems=12&vtid=fvcb49_1a2b3c4d&fvt=${TOKEN}`, link);
  check('no cbfid and no template on it', !link.includes('cbfid') && !link.includes('template'));
  check('the vtid fits ClickBank (24 characters at most, letters, digits, underscore)', /^[A-Za-z0-9_]{1,24}$/.test(new URL(link).searchParams.get('vtid') ?? ''));
  check('the token comes back unchanged from the link', new URL(link).searchParams.get(offer.CB_UNLOCK.tokenParam) === TOKEN);
  check('the link reads back as the same lead', cb.leadPrefixOfCbVtid(new URL(link).searchParams.get('vtid')) === '1a2b3c4d');
  const placements = [...offer.PLACEMENTS, ...offer.RESULT_PAGE_PLACEMENTS, ...offer.OFFER_BUTTON_PLACEMENTS] as readonly string[];
  check('fvcb49 is no placement anywhere', !placements.includes(offer.CB_UNLOCK.vtidPrefix) && !offer.isPlacement(offer.CB_UNLOCK.vtidPrefix));
  check('CB_UNLOCK as the spec fixes it', offer.CB_UNLOCK.vendor === 'bluefx02' && offer.CB_UNLOCK.item === '12' && offer.CB_UNLOCK.priceUsd === 49 && offer.CB_UNLOCK.price === '$49' && offer.CB_UNLOCK.payUrl === 'https://bluefx02.pay.clickbank.net/?cbitems=12');

  console.log('== records');
  check("no record type is 'SALE'", !(Object.values(cb.CB_VIDEO_AD_EVENTS) as string[]).includes('SALE'), show(cb.CB_VIDEO_AD_EVENTS));
  check('the record types are the spec names', cb.CB_VIDEO_AD_EVENTS.sale === 'CB_VIDEO_AD_SALE' && cb.CB_VIDEO_AD_EVENTS.refund === 'CB_VIDEO_AD_REFUND' && cb.CB_VIDEO_AD_EVENTS.testIgnored === 'CB_VIDEO_AD_TEST_IGNORED');

  console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
