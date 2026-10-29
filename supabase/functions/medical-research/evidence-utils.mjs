// Abstracts provide research context, never automatic claim verification.
export function parseAbstracts(xml) {
  const result = new Map();
  const decode = text => text.replace(/<[^>]+>/g, ' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n) => {
    const cp = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : Number(n);
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
  }).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;|&#39;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  for (const article of xml.matchAll(/<PubmedArticle\b[^>]*>([\s\S]*?)<\/PubmedArticle>/g)) {
    const id = article[1].match(/<PMID\b[^>]*>(\d+)<\/PMID>/)?.[1];
    const text = [...article[1].matchAll(/<AbstractText\b[^>]*>([\s\S]*?)<\/AbstractText>/g)].map(m=>decode(m[1])).filter(Boolean).join(' ');
    if (id && text) result.set('PMID:'+id,text.slice(0,4000));
  }
  return result;
}

export async function fetchEvidence(url, options = {}, {fetcher=fetch, sleep=ms=>new Promise(r=>setTimeout(r,ms)), timeoutMs=12000} = {}) {
  for (let attempt=0; attempt<3; attempt++) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetcher(url,{...options,signal:controller.signal});
      if (![429,502,503,504].includes(response.status) || attempt===2) return response;
      const retry=Number(response.headers.get('retry-after'));
      await response.body?.cancel();
      await sleep(Math.min(2000, Math.max(400*2**attempt, Number.isFinite(retry)?retry*1000:0)));
    } catch(error) {
      if (attempt===2) throw error;
      await sleep(400*2**attempt);
    } finally {clearTimeout(timer)}
  }
}

// Conservative relevance gate for the general healthy-adult routine pilot.
// Title matching is a retrieval screen, never clinical verification.
export function routineSourceEligible(source, domain, cutoff) {
 const title=String(source.title||'').toLowerCase();
 if (/cancer|kidney|renal|dialysis|transplant|cardiomyopathy|pregnan|postpartum|sarcopenia|multimorbid|pediatric|children|adolescen|cannabis|orexin|insomnia|dysphagia|oral.processing|placebo|brain.endurance|hydrotherapy|versican|parkinson|stroke|capsulitis|manual.therapy|rehabilitation|magnesium|melatonin/.test(title)) return false;
 const match={
  physical_activity:/physical.activity|exercise|walking/,
  sleep:/sleep.duration|sleep.hygiene|healthy.sleep|sleep.recommend|recommended.amount.of.sleep/,
  nutrition:/dietary.pattern|healthy.diet|diet.quality|mediterranean.diet/,
  sedentary:/sedentary|sitting|breaking.up/,
  yoga_safety:/yoga/,
  hydration:/water.intake|drinking.water|water.consumption|fluid.intake|hydration.status|hydration.and.health/
 }[domain];
 if (!match?.test(title)) return false;
 if (domain==='yoga_safety'&&!/safe|safety|adverse|contraindicat|injur/.test(title)) return false;
 const date=String(source.publication_date||'');
 const year=date.match(/\b(\d{4})\b/);if(!year)return false;
 if(Number(year[1])>Number(cutoff.slice(0,4)))return false;
 const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 const month=months.findIndex(m=>date.toLowerCase().includes(m));
 if(Number(year[1])===Number(cutoff.slice(0,4))&&month>=Number(cutoff.slice(5,7)))return false;
 return true;
}
