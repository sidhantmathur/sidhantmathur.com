// The job-posting corpus: turning a board API's HTML into the plain text a
// visitor would paste, labelling each posting with a role family, and the
// length arithmetic the fit check's caps impose.
//
// Pure functions only, so evals/fit-stability.test.mjs can hold them to
// hand-written fixtures. scripts/fetch-postings.mjs does the fetching.
//
// The family and control labels are a TITLE heuristic (plus a content check
// for PSA-heavy delivery roles). They say what kind of posting this is, not
// how well Sidhant fits it: that is the measurement, and labelling it here
// would be grading the answer key.

import { MAX_POSTING_TEXT } from "../../lib/job-posting.ts";

// --- HTML to plain text ------------------------------------------------------

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ",
  thinsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", sbquo: "‚",
  ldquo: "“", rdquo: "”", bdquo: "„", hellip: "…", bull: "•", middot: "·",
  trade: "™", reg: "®", copy: "©", deg: "°", times: "×", divide: "÷",
  euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", para: "¶",
  laquo: "«", raquo: "»", shy: "", zwj: "", zwnj: "", lrm: "", rlm: "",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", aacute: "á", agrave: "à",
  acirc: "â", auml: "ä", aring: "å", atilde: "ã", ccedil: "ç", iacute: "í",
  igrave: "ì", icirc: "î", iuml: "ï", ntilde: "ñ", oacute: "ó", ograve: "ò",
  ocirc: "ô", ouml: "ö", otilde: "õ", oslash: "ø", uacute: "ú", ugrave: "ù",
  ucirc: "û", uuml: "ü", szlig: "ß", Eacute: "É", Ouml: "Ö", Uuml: "Ü", Auml: "Ä",
};

/** Decodes named and numeric HTML entities. Unknown names are left as written. */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, body) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    const named = NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()];
    return named ?? whole;
  });
}

const BLOCK = "p|div|section|article|header|footer|ul|ol|table|thead|tbody|tr|blockquote|pre|figure|dl|dt|dd|hr";

/**
 * A posting's HTML as the plain text a visitor gets by selecting the page and
 * pasting it: headings and paragraphs on their own lines, list items as
 * "- " lines, no markup, no entities.
 *
 * Greenhouse sends its HTML entity-escaped (`&lt;p&gt;`), so a string with
 * escaped tags and no real ones is decoded once before parsing.
 */
export function htmlToText(html) {
  if (typeof html !== "string" || !html) return "";
  let s = html;
  if (!/<[a-z!/]/i.test(s) && /&lt;\/?[a-z]/i.test(s)) s = decodeEntities(s);

  s = s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<(h[1-6])[^>]*>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(new RegExp(`<\\/?(?:${BLOCK})\\b[^>]*>`, "gi"), "\n")
    .replace(/<\/?(?:td|th)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "");

  s = decodeEntities(s)
    .replace(/\r/g, "")
    .replace(/[   ​﻿]/g, " ")
    .replace(/[\t\f\v ]+/g, " ");

  const lines = [];
  for (let raw of s.split("\n")) {
    let line = raw.trim();
    // A bullet glyph typed into the text instead of a list item.
    line = line.replace(/^[•·▪◦●*]\s*/, "- ");
    // `<li><p>text</p></li>` leaves the marker on a line of its own.
    line = line.replace(/^-\s+[-•·▪◦●*]\s*/, "- ");
    lines.push(line);
  }
  // Merge a lone "-" with the next line that has text.
  const merged = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === "-" || line === "- ") {
      let j = i + 1;
      while (j < lines.length && !lines[j]) j += 1;
      if (j < lines.length && lines[j] && !lines[j].startsWith("- ")) {
        merged.push(`- ${lines[j]}`);
        i = j;
      }
      continue;
    }
    merged.push(line);
  }
  // `<li><p>…</p></li>` also leaves a blank line between items, which a paste
  // from the page does not have.
  const tight = merged.filter(
    (line, i) => line || !(nearest(merged, i, -1)?.startsWith("- ") && nearest(merged, i, 1)?.startsWith("- ")),
  );
  return tight.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** The nearest line with text before (-1) or after (1) index `from`. */
function nearest(lines, from, step) {
  for (let i = from + step; i >= 0 && i < lines.length; i += step) if (lines[i]) return lines[i];
  return null;
}

// --- What the site does with a long posting ----------------------------------

/**
 * What the paste panel sends for a pasted posting. The textarea slices every
 * change at MAX_POSTING_TEXT (so a long paste is cut silently, before anyone
 * presses the button), then submit trims the result. Mirrored from
 * JobDescriptionForm in components/shell/panel-body.tsx.
 */
export function pastedAsSent(text) {
  return text.slice(0, MAX_POSTING_TEXT).trim();
}

const QUALIFICATIONS_HEADER =
  /^(?:#+\s*)?(?:(?:minimum|basic|preferred|required|key|desired|bonus)\s+)?(?:requirements?|qualifications?|skills(?:\s+(?:and|&)\s+(?:experience|qualifications))?|experience(?:\s+(?:and|&)\s+skills)?|what you(?:'|’| wi)ll (?:need|bring)|what (?:you )?(?:we(?:'|’)re|we are) looking for|what we(?:'|’)re looking for|who you are|about you|you (?:have|bring|might be|may be|will have|should have)|you(?:'|’)ll (?:have|thrive|be a great fit)|you(?:'|’)re (?:a (?:great|good|strong) fit|someone who)|ideal candidate|what makes you|must[- ]haves?|nice[- ]to[- ]haves?|we(?:'|’)d love (?:to hear from you|if you)|to be successful|is this you|are you)\b[^\n]{0,60}$/i;

const ROLE_HEADER =
  /^(?:#+\s*)?(?:about the (?:role|team|job|position|opportunity)|the role|role (?:overview|summary)|the opportunity|your (?:role|impact|mission)|in this role|what you(?:'|’| wi)ll (?:do|work on|own)|(?:key |core )?responsibilities|what you(?:'|’)ll be doing|job (?:description|summary)|position (?:overview|summary)|the work)\b[^\n]{0,60}$/i;

function headerOffset(text, pattern) {
  let offset = 0;
  for (const line of text.split("\n")) {
    if (line.length <= 90 && pattern.test(line.trim())) return offset;
    offset += line.length + 1;
  }
  return null;
}

/** Where the qualifications section starts, in characters, or null if none is recognisable. */
export function qualificationsOffset(text) {
  return headerOffset(text, QUALIFICATIONS_HEADER);
}

/** Where the role-specific part starts (after company boilerplate), or null. */
export function roleOffset(text) {
  return headerOffset(text, ROLE_HEADER);
}

/** List items ("- " lines): a proxy for how many requirements a posting states. */
export function listItemCount(text) {
  return text.split("\n").filter((l) => l.startsWith("- ")).length;
}

/**
 * The length facts recorded on every posting. `cutBySite` is whether the paste
 * panel would cut it off; `qualificationsLost` whether the cut falls before
 * the qualifications section even begins, so the model never sees one
 * requirement of it.
 */
export function lengthFacts(text) {
  const length = text.length;
  const cutBySite = length > MAX_POSTING_TEXT;
  const qualificationsAt = qualificationsOffset(text);
  return {
    length,
    cutBySite,
    charsLost: cutBySite ? length - MAX_POSTING_TEXT : 0,
    qualificationsAt,
    qualificationsLost: cutBySite && qualificationsAt != null && qualificationsAt >= MAX_POSTING_TEXT,
    roleAt: roleOffset(text),
    listItems: listItemCount(text),
  };
}

// --- Compensation ------------------------------------------------------------

const MONEY = String.raw`(?:CA\$|C\$|US\$|A\$|\$|£|€)\s?\d{1,3}(?:[,.\s]\d{3})*(?:\.\d+)?\s?[kK]?`;
const RANGE = new RegExp(`${MONEY}(?:\\s?(?:-|–|—|to)\\s?${MONEY})?(?:\\s?(?:USD|CAD|EUR|GBP))?`);

/**
 * A salary range stated in the posting's own text, with where it sits. Only on
 * a line that talks about pay, so a "$275B in annualized spend" line in the
 * company blurb is not read as a salary.
 */
export function compensationFromText(text) {
  let offset = 0;
  for (const line of text.split("\n")) {
    if (/\b(?:salary|compensation|pay range|base pay|base salary|OTE|on[- ]target|annual|hiring range|pay transparency)\b/i.test(line)) {
      const m = RANGE.exec(line);
      if (m && /\d{2,}/.test(m[0].replace(/[,.\s]/g, ""))) {
        return { text: m[0].trim(), at: offset + m.index };
      }
    }
    offset += line.length + 1;
  }
  return null;
}

// --- Labelling ---------------------------------------------------------------

/** Role families, in the order the corpus is sorted and reported. */
export const FAMILIES = [
  "revops",
  "sales-ops",
  "gtm-systems",
  "sales-revenue-analytics",
  "delivery-program-ops",
];

/** Control kinds. `none` is a posting in one of the families above. */
export const CONTROLS = ["none", "near-miss", "mismatch"];

// Titles that are none of the families however they're worded: recruiting,
// HR, legal, finance, security, facilities and the like. Checked first.
const OUT_OF_SCOPE =
  /\b(?:recruit(?:er|ing|ment)?|talent|sourc(?:er|ing)|people (?:partner|operations|programs?|analytics|systems|technology|business partner)|hrbp|human resources|\bhr\b|legal|counsel|paralegal|payroll|benefits|tax|accounting|accountant|treasury|procurement|privacy|trust (?:&|and) safety|fraud|financial crime|kyc|underwriting|compliance|data cent(?:er|re)|facilities|workplace|real estate|it (?:support|operations)|help ?desk|intern(?:ship)?|new grad|clinical|copywriter|brand|communications|comms|social media|events?|editorial|design program|compensation program|marketing program manager|field marketing|campaign|product operations|chief of staff|executive (?:assistant|business partner|operations partner)|supply|manufacturing|logistics|warehouse|fleet|hardware|silicon|power plant|electrician|technician|finance|fp&a|financial analyst|strategic finance|loan|banking|brokerage|crypto|payments? operations|security|threat|enablement|forward deployed|deployment strategist|fde|social|regulatory|creative|risk|verifications?|site reliability|power generation|support specialist|intelligence systems|people|webinar|web program|digital program|learning (?:&|and) development|l&d|advocacy|research program|startup program|community|academic|education|content|cyber|harm|safety|safeguards|office operations|financial crimes?|investor relations|kyb|audit|email operations|research operations|carrier|compute strategy|infrastructure (?:strategy|business operations)|trust|human data|model operations|apprenticeship|quality analyst)\b/i;

// Near misses: titles in his families' neighbourhood whose centre is a gap the
// gauntlet log names ("no Salesforce admin build work, no CPQ or deal desk, no
// PSA, SOW or billable-utilization experience").
const NEAR_MISS = [
  {
    kind: "salesforce-admin",
    family: "gtm-systems",
    re: /\bsalesforce\b[^|]*\b(?:admin|administrator|developer|architect|engineer|consultant|business systems)\b|\b(?:admin|administrator|developer|architect)\b[^|]*\bsalesforce\b|\bcrm (?:admin|administrator|developer)\b|\brevenue operations systems admin\b/i,
  },
  {
    kind: "cpq-deal-desk",
    family: "sales-ops",
    re: /\bcpq\b|quote[- ]to[- ]cash|\bq2c\b|order[- ]to[- ]cash|\border management\b|\bdeal desk\b|\bdeal (?:strategy (?:&|and) )?op(?:eration)?s\b|\bbilling (?:systems|operations)\b/i,
  },
];

// Delivery titles that become a near miss when the posting centres on PSA work.
const DELIVERY_TITLE =
  /\b(?:professional services|services (?:strategy (?:&|and) )?op(?:eration)?s|delivery|resource (?:management|manager|planning)|project operations|pmo|engagement operations|implementation|consulting operations|customer operations)\b/i;

const PSA_SIGNALS = [
  /\bPSA\b/,
  /professional services automation/i,
  /\bbillable\b/i,
  /\butili[sz]ation\b/i,
  /\bSOWs?\b|statements? of work/i,
  /\b(?:Kantata|Certinia|FinancialForce|Mavenlink|OpenAir|Rocketlane|Replicon|Planview|Projector)\b/i,
  /\bresource (?:management|planning|scheduling|allocation)\b/i,
  /\bproject (?:accounting|margin|financials)\b/i,
];

/** How many PSA signals a posting's text carries. */
export function psaScore(text) {
  return PSA_SIGNALS.filter((re) => re.test(text)).length;
}

const PSA_NAMED = /\bPSA\b|professional services automation|\b(?:Kantata|Certinia|FinancialForce|Mavenlink|OpenAir|Rocketlane|Replicon|Planview)\b/i;

// Deliberate mismatches: roles nothing in his record covers.
const MISMATCH = [
  {
    kind: "ml-infra",
    re: /\b(?:ml|ai|machine learning|inference|training|gpu|cuda|kernel|model|llm)\b[^|]*\b(?:infrastructure|infra|systems|platform|scaling|performance)\b[^|]*\b(?:engineer|scientist|researcher)\b|\b(?:inference|gpu|cuda|kernel|pre-?training|post-?training|mid-?training|model)\b[^|]*\bengineer\b|\bresearch (?:engineer|scientist)\b|\bmachine learning (?:engineer|research)|\bml (?:research )?engineer\b|\bmember of technical staff\b/i,
    unless: /\b(?:gtm|go[- ]to[- ]market|sales|solutions|support|customer|revenue|business|operations|deployment|success|marketing|partner|analytics|data analyst|program manager|product manager|applications? engineer)\b/i,
  },
  {
    kind: "staff-swe",
    re: /\b(?:staff|principal|senior staff|distinguished)\b[^|]*\b(?:software|backend|back[- ]end|frontend|front[- ]end|full[- ]?stack|infrastructure|platform|distributed systems|systems|product)\b[^|]*\bengineer\b|\b(?:staff|principal) engineer\b/i,
    unless: /\b(?:gtm|go[- ]to[- ]market|business systems|solutions|sales|support|customer|analytics|revenue|program)\b/i,
  },
  {
    kind: "enterprise-ae",
    re: /\baccount executive\b|\baccount director\b|\b(?:enterprise|strategic|mid[- ]?market|commercial|majors?|named) (?:sales|account) (?:executive|manager)\b/i,
    unless: /\b(?:operations|enablement|development representative|sdr|bdr|recruit)\b/i,
  },
  {
    kind: "people-manager",
    re: /\bengineering manager\b|\bmanager,? (?:software )?engineering\b|\b(?:director|head|vp|vice president|senior director),? (?:of )?(?:software |platform |product )?engineering\b/i,
    unless: /\b(?:gtm|go[- ]to[- ]market|business systems|analytics engineering|sales|solutions|field|support|customer|revenue)\b/i,
  },
];

// The families, most specific first. A title takes the first that matches.
const FAMILY_RULES = [
  {
    family: "revops",
    re: /\brevenue (?:operations|strategy|excellence)\b|\brev ?ops\b|\bgo[- ]to[- ]market (?:strategy|operations|ops|planning)\b|\bgtm (?:strategy|operations|ops|planning|business (?:operations|planning)|excellence|field operations)\b|\bmarketing operations\b|\bcommercial operations\b|\bfield operations\b|\brevenue (?:strategy )?(?:&|and) op/i,
  },
  {
    family: "sales-ops",
    re: /\bsales (?:strategy (?:&|and) |and |& )?op(?:eration)?s\b|\bsales strategy\b|\bsales (?:planning|compensation|comp|programs?)\b|\b(?:sales|gtm) (?:compensation|incentive)|\bincentive compensation\b|\bcommissions?\b|\bterritory (?:planning|design|operations|strategy)\b|\bquota (?:planning|setting)\b|\b(?:partner|channels?|alliances?|ecosystem) (?:program )?op(?:eration)?s\b|\bpricing (?:strategy|operations)\b|\brenewals operations\b|\bsales (?:&|and) (?:strategy|operations)\b/i,
  },
  {
    family: "gtm-systems",
    re: /\bgtm (?:systems|engineer(?:ing)?|tools|tooling|automation|applications|ai engineer|devops|ai operations|ai product)\b|\bgo[- ]to[- ]market (?:systems|engineer(?:ing)?)\b|\bbusiness (?:systems|applications|technology)\b|\b(?:sales|revenue|crm|marketing) (?:systems|technology|tech)\b|\bcrm (?:manager|lead|operations|engineer|analyst)\b|\bmartech\b|\benterprise (?:applications|systems)\b|\bsystems analyst\b|\bai (?:engineer|automation|transformation)[^|]*\b(?:gtm|revenue|sales)\b|\b(?:software |ai |automation |systems )?engineer,? (?:gtm|go[- ]to[- ]market)\b|\bgtm insights automation\b/i,
    unless: /\b(?:backend|front[- ]?end|full[- ]?stack|staff|principal)\b[^|]*\bengineer\b/i,
  },
  {
    family: "sales-revenue-analytics",
    re: /\b(?:sales|revenue|gtm|go[- ]to[- ]market|commercial|business|growth|pricing|customer|marketing|strategy|forecasting|bi|insights|reporting|data|enterprise|field) analy(?:st|tics)\b|\banalytics (?:manager|lead|engineer|partner|director|& strategy|and strategy)\b|\bmanager, analytics\b|\bbusiness intelligence\b|\b(?:revenue|sales|gtm|go[- ]to[- ]market) (?:insights|intelligence|data|reporting)\b|\banalytics engineer\b|\bdecision (?:science|intelligence)\b|\bdata analytics manager\b/i,
  },
  {
    family: "delivery-program-ops",
    re: /\bdelivery (?:operations|manager|lead|program)\b|\bprogram operations\b|\boperations program manager\b|\bprogram (?:manager|lead)\b[^|]*\b(?:operations|delivery|customer|cx|gtm|go[- ]to[- ]market|services|support|success|implementation|business|enterprise|strategic|cco|ceo|field|revenue|sales|partner|deal|programs)\b|\b(?:operations|delivery|customer|cx|gtm|services|support|success|implementation|business|strategic|field|revenue|sales|partner) program (?:manager|lead)\b|\bstrategic programs\b|\b(?:customer (?:success|experience|support)|cs|cx|success|support|services|customer|user|global services) (?:strategy (?:&|and) )?op(?:eration)?s\b|\bimplementation (?:operations|program|manager)\b|\bdeployment (?:operations|strategy|strategist)\b|\bworkforce (?:management|planning)\b|\bcapacity planning\b|\bbusiness operations\b|\bbiz ?ops\b|\bstrategy (?:&|and) op(?:eration)?s\b|\bs&o\b|\boperations (?:manager|lead|analyst|associate|strategist|program)\b|\bgrowth operations\b|\bmarketplace operations\b|\bplanning (?:&|and) strategic operations\b|\bstrategic operations\b/i,
  },
];

const TPM = /\btechnical program manag/i;
const TPM_IN_SCOPE = /\b(?:gtm|go[- ]to[- ]market|business|customer|field|delivery|deployment|launch|operations|efficiency|programs? office)\b/i;

/**
 * Labels one posting: `{ family, control, kind }`, or null when it belongs in
 * none of the families and is not a control either (the large majority of any
 * board). `kind` says which rule fired, for the corpus report.
 *
 * Order matters: near misses, then mismatches, then families from most to
 * least specific. A "Salesforce Administrator, Revenue Operations" is a near
 * miss, not a RevOps posting.
 */
export function classifyPosting(title, text = "") {
  const t = ` ${String(title ?? "").replace(/\s+/g, " ").trim()} `;
  if (OUT_OF_SCOPE.test(t)) return null;

  for (const rule of NEAR_MISS) {
    if (rule.re.test(t)) return { family: familyOf(t) ?? rule.family, control: "near-miss", kind: rule.kind };
  }

  for (const rule of MISMATCH) {
    if (rule.re.test(t) && !(rule.unless && rule.unless.test(t))) {
      return { family: null, control: "mismatch", kind: rule.kind };
    }
  }

  if (TPM.test(t) && !TPM_IN_SCOPE.test(t.replace(/program manag\w*/i, ""))) return null;

  const family = familyOf(t);
  if (!family) return null;
  // An engineering title that names a family's subject ("Staff Software
  // Engineer, Sales Data") is an engineering role. GTM engineering is the one
  // family with engineers in it, and its own rule screens those titles.
  if (family !== "gtm-systems" && /\b(?:software|backend|front[- ]?end|full[- ]?stack|staff|principal) engineer\b/i.test(t)) return null;

  // PSA-heavy delivery: the record has no PSA, SOW or utilization work, so a
  // delivery posting that centres on it is a near miss rather than a fit.
  if (DELIVERY_TITLE.test(t) && (psaScore(text) >= 3 || (PSA_NAMED.test(text) && psaScore(text) >= 2))) {
    return { family, control: "near-miss", kind: "psa-delivery" };
  }
  return { family, control: "none", kind: family };
}

function familyOf(t) {
  for (const rule of FAMILY_RULES) {
    if (rule.re.test(t) && !(rule.unless && rule.unless.test(t))) return rule.family;
  }
  return null;
}

// --- Dedupe ------------------------------------------------------------------

/** Lowercased word set, for near-duplicate detection. */
function wordSet(text) {
  return new Set(text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length > 2));
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function normalizeTitle(title) {
  return String(title ?? "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[-–—|]\s*(?:remote|hybrid|on-?site)\b.*$/, " ")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

/** A stable 32-bit hash, for deterministic sampling. */
export function hash32(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Drops duplicates: the same posting under two ids, the same text twice, and
 * one role posted once per city. A repost is the same company with
 * near-identical text: `sameTitle` similarity when the titles match, the
 * stricter `anyTitle` when they don't ("…, Germany" and "…, France" are one
 * role). Different roles at one company share their boilerplate but not their
 * role sections, so they stay well under either. Keeps the first of each, so
 * sort before calling.
 */
export function dedupePostings(postings, { sameTitle = 0.8, anyTitle = 0.9 } = {}) {
  const kept = [];
  const seenIds = new Set();
  const seenText = new Set();
  const byCompany = new Map();
  let dropped = 0;
  for (const p of postings) {
    const textKey = hash32(p.text.replace(/\s+/g, " ").toLowerCase());
    if (seenIds.has(p.id) || seenText.has(textKey)) {
      dropped += 1;
      continue;
    }
    const title = normalizeTitle(p.title);
    const words = wordSet(p.text);
    const siblings = byCompany.get(p.company.toLowerCase()) ?? [];
    const repost = siblings.some((s) => {
      const sim = jaccard(s.words, words);
      return sim >= anyTitle || (s.title === title && sim >= sameTitle);
    });
    if (repost) {
      dropped += 1;
      continue;
    }
    siblings.push({ title, words });
    byCompany.set(p.company.toLowerCase(), siblings);
    seenIds.add(p.id);
    seenText.add(textKey);
    kept.push(p);
  }
  return { kept, dropped };
}

/** Postings shorter than this are a stub or a redirect, not a posting. */
export const MIN_POSTING_CHARS = 800;
