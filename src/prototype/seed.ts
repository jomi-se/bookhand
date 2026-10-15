import type { Artifact, Conversation, Memory, Voice } from './model.ts'
import bitOfABit from './artifacts/bit-of-a-bit.html?raw'
import ordersOfSmallness from './artifacts/orders-of-smallness.html?raw'
import dreadfulSymbols from './artifacts/dreadful-symbols.html?raw'
import whereE from './artifacts/where-e-comes-from.html?raw'
import strips from './artifacts/strips-into-area.html?raw'
import keepOrNeglect from './artifacts/keep-or-neglect.html?raw'
import bookMap from './artifacts/book-map.html?raw'
import ladder from './artifacts/ladder.html?raw'
import warmUp from './artifacts/warm-up-ch3.html?raw'

/** The prototype seeds one bundled, public-domain technical book. */
export function isSeededBook(title: string): boolean {
  return /calculus made easy/i.test(title)
}

const day = (daysAgo: number, hour = 21) => {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, 12, 0, 0)
  return date.toISOString()
}

export const CHAPTERS: Record<number, string> = {
  7: 'Prologue',
  8: 'I · Preliminary terrors',
  9: 'II · Degrees of smallness',
  10: 'III · Relative growings',
  11: 'Note to III',
  12: 'IV · Simplest cases',
  13: 'V · Constants',
  14: 'VI · Sums, products, quotients',
  15: 'VII · Successive differentiation',
  16: 'VIII · When time varies',
  17: 'IX · A useful dodge',
  18: 'X · Geometrical meaning',
  19: 'XI · Maxima and minima',
  20: 'XII · Curvature',
  21: 'XIII · Other useful dodges',
  22: 'XIV · Compound interest',
  23: 'XV · Sines and cosines',
  24: 'XVI · Partial differentiation',
  25: 'XVII · Integration',
  26: 'XVIII · Reverse of differentiating',
  27: 'XIX · Finding areas',
  28: 'XX · Dodges and triumphs',
  29: 'XXI · Finding solutions',
}

export const LADDER_ANCHOR = {
  sectionIndex: 10,
  text: 'Now, if you were to pull the bottom end out 1 inch more, how much would the top end come down?',
  chapter: CHAPTERS[10]!,
}

export const LADDER_HTML = ladder

export const SEED_ARTIFACTS: readonly Artifact[] = [
  {
    id: 'book-map',
    title: 'Your map of the book',
    summary: 'Twenty-one chapters as a trail, coloured by what you have understood.',
    kind: 'map',
    marking: 'pin',
    hue: 'plum',
    glyph: '◎',
    html: bookMap,
    author: 'tutor',
    createdAt: day(0, 8),
    versions: 4,
    poster: 'map',
  },
  {
    id: 'dreadful-symbols',
    title: 'Two dreadful symbols, defused',
    summary: 'd is “a little bit of”; ∫ is “the sum of”. Tap them, then cut an hour into 3,600 bits.',
    kind: 'animation',
    anchor: { sectionIndex: 8, text: 'merely means "a little bit of."', chapter: CHAPTERS[8]! },
    marking: 'wash',
    hue: 'amber',
    glyph: '∫',
    html: dreadfulSymbols,
    author: 'tutor',
    createdAt: day(3),
    versions: 1,
    poster: 'symbols',
  },
  {
    id: 'orders-of-smallness',
    title: 'Minùtes of minùtes',
    summary: 'Zoom from an hour to a “second minùte”, and watch a farthing vanish next to £1000.',
    kind: 'animation',
    anchor: {
      sectionIndex: 9,
      text: 'There are 60 minutes in the hour, 24 hours in the day, 7 days in the week. There are therefore 1440 minutes in the day and 10080 minutes in the week.',
      chapter: CHAPTERS[9]!,
    },
    marking: 'margin',
    hue: 'sky',
    glyph: '⌕',
    html: ordersOfSmallness,
    author: 'tutor',
    createdAt: day(2),
    versions: 2,
    poster: 'orders',
  },
  {
    id: 'bit-of-a-bit',
    title: 'The bit of a bit',
    summary: 'Fig. 1, alive: drag dx and watch the corner square vanish faster than the strips.',
    kind: 'interactive',
    anchor: { sectionIndex: 9, text: 'Geometrically this may be depicted as follows: Draw a square (Fig. 1) the side of which we will take to represent', chapter: CHAPTERS[9]! },
    marking: 'margin',
    hue: 'terracotta',
    glyph: '✦',
    html: bitOfABit,
    author: 'tutor',
    createdAt: day(1),
    versions: 3,
    poster: 'square',
    conversationId: 'c-ch2',
  },
  {
    id: 'keep-or-neglect',
    title: 'Keep or neglect?',
    summary: 'Six terms. Swipe right to keep, left to throw away. Watch out for the farthing.',
    kind: 'check',
    anchor: {
      sectionIndex: 9,
      text: 'Hence we know that in all cases we are justified in neglecting the small quantities of the second-or third (or higher)—orders, if only we take the small quantity of the first order small enough in itself.',
      chapter: CHAPTERS[9]!,
    },
    marking: 'pin',
    hue: 'plum',
    glyph: '?',
    html: keepOrNeglect,
    author: 'tutor',
    createdAt: day(1, 22),
    versions: 1,
    poster: 'cards',
  },
  {
    id: 'farthing-note',
    title: 'The farthing trap',
    summary: 'Small is relative to what it’s multiplied by.',
    kind: 'note',
    anchor: {
      sectionIndex: 9,
      text: 'Even a farthing becomes important if only it is multiplied by a few hundred.',
      chapter: CHAPTERS[9]!,
    },
    marking: 'pin',
    hue: 'amber',
    glyph: '✎',
    html: noteHtml(
      'Small is relative to <em>what it’s multiplied by</em>. (dx)² alone is nothing, but (dx)² × a million might not be. Check what’s next to the tiny thing before throwing it away.',
      'Even a farthing becomes important if only it is multiplied by a few hundred.',
      9,
      'Chapter II',
    ),
    author: 'reader',
    createdAt: day(1, 23),
    versions: 1,
    poster: 'note',
  },
  {
    id: 'kept-first-order',
    title: '“It just shrinks faster”',
    summary: 'Kept from the chat about (dx)²',
    kind: 'kept',
    anchor: {
      sectionIndex: 9,
      text: 'The second term is not negligible because it is a first-order quantity',
      chapter: CHAPTERS[9]!,
    },
    marking: 'pin',
    hue: 'moss',
    glyph: '❝',
    html: keptHtml(
      '<p>The corner isn’t <strong>zero</strong>. It just shrinks <strong>faster</strong> than everything you’re keeping. Halve dx and the strips halve, but the corner <em>quarters</em>.</p>',
      'Chapter II · with your tutor',
    ),
    author: 'kept',
    createdAt: day(1, 21),
    versions: 1,
    poster: 'kept',
    conversationId: 'c-ch2',
  },
  {
    id: 'warm-up-ch3',
    title: 'Warm-up: from bits to ratios',
    summary: 'Five minutes before Chapter III: what you know, Fig. 4 alive, one quick check.',
    kind: 'session',
    anchor: {
      sectionIndex: 10,
      text: 'ALL through the calculus we are dealing with quantities that are growing, and with rates of growth.',
      chapter: CHAPTERS[10]!,
    },
    marking: 'pin',
    hue: 'amber',
    glyph: '◷',
    html: warmUp,
    author: 'tutor',
    createdAt: day(0, 7),
    versions: 1,
    poster: 'session',
  },
  {
    id: 'where-e-comes-from',
    title: 'Where e comes from',
    summary: 'Add interest more and more often, and £100 creeps up on £271.83.',
    kind: 'interactive',
    anchor: { sectionIndex: 22, text: 'will multiply the original capital by 2.59374', chapter: CHAPTERS[22]! },
    marking: 'wash',
    hue: 'moss',
    glyph: 'e',
    html: whereE,
    author: 'tutor',
    createdAt: day(6),
    versions: 1,
    poster: 'e',
  },
  {
    id: 'strips-into-area',
    title: 'Strips into area',
    summary: 'Slice the area under a curve, add up y·dx, and let the strips get thin.',
    kind: 'interactive',
    anchor: {
      sectionIndex: 27,
      text: 'The secret of solving this problem is to conceive the area as being divided up into a lot of narrow strips',
      chapter: CHAPTERS[27]!,
    },
    marking: 'margin',
    hue: 'sky',
    glyph: '∫',
    html: strips,
    author: 'tutor',
    createdAt: day(8),
    versions: 1,
    poster: 'strips',
  },
]

export function noteHtml(text: string, quote: string | undefined, section: number | undefined, cite: string) {
  return `<style>
  .note { position: relative; margin: 12px 0; padding: 22px 20px 18px; border-radius: 6px 18px 18px 18px;
    background: repeating-linear-gradient(to bottom, transparent 0 29px, color-mix(in oklch, var(--bh-sky) 18%, transparent) 29px 30px),
      color-mix(in oklch, var(--bh-amber) 10%, var(--bh-raised));
    box-shadow: var(--bh-shadow); font: 500 1.08rem/30px var(--bh-serif); }
  .note::before { content: ''; position: absolute; top: -9px; left: 22px; width: 64px; height: 18px; border-radius: 3px;
    background: color-mix(in oklch, var(--bh-amber) 45%, transparent); transform: rotate(-3deg); }
  .note-by { margin-top: 10px; font: 600 .7rem/1 var(--bh-sans); letter-spacing: .1em; text-transform: uppercase; color: var(--bh-muted); }
</style>
<p class="bh-eyebrow">Your note</p>
<div class="note">${text}<div class="note-by">You, in the margin</div></div>
${quote ? `<bh-quote ${section === undefined ? '' : `section="${section}"`} cite="${cite}">${quote}</bh-quote>` : ''}`
}

export function keptHtml(html: string, cite: string) {
  return `<style>
  .kept { margin: 14px 0; padding: 18px 18px 14px 20px; border-radius: 18px; background: var(--bh-raised);
    border: 1px solid var(--bh-rule); box-shadow: var(--bh-shadow); position: relative; font-size: 1.02rem; }
  .kept::before { content: '❝'; position: absolute; top: -18px; left: 12px; font: 400 3rem/1 var(--bh-display); color: var(--bh-moss); }
  .kept-by { margin-top: 8px; font: 600 .7rem/1 var(--bh-sans); letter-spacing: .1em; text-transform: uppercase; color: var(--bh-moss); }
</style>
<p class="bh-eyebrow" style="color:var(--bh-moss)">Kept from chat</p>
<div class="kept">${html}<div class="kept-by">${cite}</div></div>`
}

export const SEED_MEMORIES: readonly Memory[] = [
  {
    id: 'm-dx2',
    kind: 'understood',
    text: 'Finally got why (dx)² can be dropped: it is a “bit of a bit”, and the corner vanishes faster than the strips.',
    sectionIndex: 9,
    by: 'tutor',
    createdAt: day(1, 21),
  },
  {
    id: 'm-cheating',
    kind: 'struggled',
    text: 'Felt that throwing away (dx)² was cheating, until seeing the square at dx = x⁄60.',
    sectionIndex: 9,
    by: 'tutor',
    createdAt: day(1, 21),
  },
  {
    id: 'm-integral',
    kind: 'understood',
    text: '∫ just means “the sum of”. The long S doesn’t scare you any more.',
    sectionIndex: 8,
    by: 'tutor',
    createdAt: day(3),
  },
  {
    id: 'm-ratio',
    kind: 'struggled',
    text: 'Still mixes up dy⁄dx (a ratio) with dy and dx (the bits themselves).',
    sectionIndex: 10,
    by: 'tutor',
    createdAt: day(0, 9),
  },
  {
    id: 'm-smug',
    kind: 'opinion',
    text: 'Thompson is charming, but a bit smug about “ordinary mathematicians”.',
    sectionIndex: 7,
    by: 'reader',
    createdAt: day(4),
  },
  {
    id: 'm-picture',
    kind: 'preference',
    text: 'Wants the picture before the algebra, and math big enough to read on a phone at night.',
    by: 'tutor',
    createdAt: day(5),
  },
]

export const SEED_VOICE: Voice = {
  global:
    'Warm, quick, a bit playful. Lead with the picture, then the algebra. Get properly excited when something clicks, and say so plainly when something is genuinely hard. No preamble, no “great question”. Tease gently; never condescend.',
  book:
    'For Thompson: lean into the “fellow fools” bit, we’re figuring it out together. You find him charming but smug, so a little side-eye is welcome.',
}

const TUTOR_DX2 = `<style>
  .m-bars { display: grid; gap: 8px; margin: 12px 0 4px; }
  .m-bar { display: grid; grid-template-columns: 76px 1fr 64px; align-items: center; gap: 8px; font-size: .82rem; }
  .m-track { height: 12px; border-radius: 99px; background: var(--bh-rule); overflow: hidden; }
  .m-fill { height: 100%; border-radius: 99px; transition: width .35s var(--bh-ease); }
  .m-bar b { font: 600 .8rem/1 var(--bh-mono); text-align: right; font-variant-numeric: tabular-nums; }
</style>
<p>It <em>does</em> feel like cheating, and Thompson knows it. That's why he draws a picture instead of arguing.</p>
<bh-math block>(x+dx)^2 = x^2 + 2x\\,dx + (dx)^2</bh-math>
<p>Say dx is <bh-scrub id="m-n" min="2" max="1000" value="60" sensitivity="3"></bh-scrub> of x. Drag that number. Then:</p>
<div class="m-bars">
  <div class="m-bar"><span>two strips</span><div class="m-track"><div class="m-fill" id="m-s" style="background:var(--bh-amber)"></div></div><b id="m-sv"></b></div>
  <div class="m-bar"><span>the corner</span><div class="m-track"><div class="m-fill" id="m-c" style="background:var(--bh-sky)"></div></div><b id="m-cv"></b></div>
</div>
<p>The corner isn’t <strong>zero</strong>. It just shrinks <strong>faster</strong> than everything you’re keeping. Halve dx and the strips halve, but the corner <em>quarters</em>.</p>
<script>
(() => {
  const s = document.getElementById('m-n')
  s.format = (v) => '1⁄' + Math.round(v)
  s.refresh()
  const paint = (n) => {
    const strips = 2 / n, corner = 1 / (n * n)
    const w = (v) => Math.max(1.5, (Math.log10(v) + 7) / 7 * 100)
    document.getElementById('m-s').style.width = w(strips) + '%'
    document.getElementById('m-c').style.width = w(corner) + '%'
    const f = (v) => v >= .01 ? (v * 100).toFixed(1) + '%' : '1⁄' + Math.round(1 / v).toLocaleString()
    document.getElementById('m-sv').textContent = f(strips)
    document.getElementById('m-cv').textContent = f(corner)
  }
  s.addEventListener('input', (e) => paint(e.detail))
  paint(60)
})()
</script>`

const TUTOR_STRIPS = `<p>Because <strong>each strip is x long</strong>, and x is an ordinary, grown-up size. So x·dx is “a bit”, first order, and two of them are still first order.</p>
<p>Only when you multiply <em>two bits together</em> (dx·dx) do you get a bit of a bit. That's the one Thompson lets you drop.</p>
<bh-callout kind="insight">Count the d's. One d: keep it. Two or more multiplied together: neglect it.</bh-callout>
<p>I put the square on the page so you can play with it. Look for the stroke in the margin by Fig. 1.</p>`

export const SEED_CONVERSATIONS: readonly Conversation[] = [
  {
    id: 'c-ch2',
    title: 'Why can I throw away (dx)²?',
    sectionIndex: 9,
    chapter: CHAPTERS[9]!,
    anchorText: 'The second term is not negligible because it is a first-order quantity',
    createdAt: day(1, 21),
    messages: [
      {
        id: 'c2-1',
        role: 'reader',
        body: 'why can I just throw away (dx)²?? it feels like cheating',
        passage: 'The square of this is x² + 2x·dx + (dx)². The second term is not negligible because it is a first-order quantity…',
        createdAt: day(1, 21),
      },
      {
        id: 'c2-2',
        role: 'tutor',
        body: TUTOR_DX2,
        receipts: ['Read Chapter II', 'Looked at Fig. 1', 'Recalled: picture first'],
        remembered: 'Felt that throwing away (dx)² was cheating',
        createdAt: day(1, 21),
      },
      {
        id: 'c2-3',
        role: 'reader',
        body: 'ohhh a bit of a bit. ok but then why does 2x·dx survive',
        createdAt: day(1, 21),
      },
      {
        id: 'c2-4',
        role: 'tutor',
        body: TUTOR_STRIPS,
        receipts: ['Made an artifact'],
        remembered: '“A bit of a bit” is the phrase that clicked',
        artifactId: 'bit-of-a-bit',
        createdAt: day(1, 21),
      },
    ],
  },
]

/** The scripted "Ask" flow for the ladder passage in Chapter III. */
export const LADDER_REPLY = `<p>Let's pull it and see. Thompson's numbers: the foot goes from <strong>19″ to 20″</strong>, and the top drops from 180″ to <strong>179.89″</strong>, only 0.11″.</p>
<bh-math block>\\frac{dy}{dx} \\approx -\\frac{0.11}{1}</bh-math>
<p>A steep ladder barely moves at the top. Flatten it out and the top starts to <em>plummet</em>. Same ladder, different ratio. That's why dy⁄dx depends on <em>where</em> you are, not just on the ladder.</p>
<p>You like the picture first, so I built you one to pull ↓</p>`

export const LADDER_REPLY_TEXT =
  "Let's pull it and see. Thompson's numbers: the foot goes from 19″ to 20″, and the top drops from 180″ to 179.89″, only 0.11″. A steep ladder barely moves at the top. Flatten it out and the top starts to plummet. Same ladder, different ratio. That's why dy⁄dx depends on where you are, not just on the ladder. You like the picture first, so I built you one to pull ↓"

export const LADDER_ARTIFACT: Artifact = {
  id: 'ladder',
  title: 'Pull the ladder',
  summary: 'Drag the foot of Fig. 5’s ladder, watch dy⁄dx change, and find the one special position.',
  kind: 'interactive',
  anchor: LADDER_ANCHOR,
  marking: 'margin',
  hue: 'amber',
  glyph: '⟋',
  html: ladder,
  author: 'tutor',
  createdAt: new Date().toISOString(),
  versions: 1,
  poster: 'ladder',
}
