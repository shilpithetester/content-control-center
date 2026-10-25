import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAbstracts,fetchEvidence} from './evidence-utils.mjs';
test('multiline structured abstracts, inline markup, unicode and article mapping',()=>{
 const xml='<PubmedArticleSet><PubmedArticle>\n<MedlineCitation><PMID Version="1">123</PMID><Abstract><AbstractText Label="A">Sleep <i>quality</i> &amp; health.</AbstractText>\n<AbstractText>Adults &#x2265;18.</AbstractText></Abstract></MedlineCitation></PubmedArticle><PubmedArticle><PMID>456</PMID></PubmedArticle></PubmedArticleSet>';
 const parsed=parseAbstracts(xml);assert.equal(parsed.size,1);assert.equal(parsed.get('PMID:123'),'Sleep quality & health. Adults ≥18.');
});
test('empty and unavailable abstracts stay absent',()=>{assert.equal(parseAbstracts('').size,0);assert.equal(parseAbstracts('<PubmedArticle><PMID>1</PMID><AbstractText> </AbstractText></PubmedArticle>').size,0)});
test('NCBI rate limit retries are bounded and recover',async()=>{let n=0;const waits=[];const r=await fetchEvidence('https://example.test',{}, {fetcher:async()=>new Response('x',{status:++n<3?429:200,headers:{'retry-after':'10'}}),sleep:async ms=>waits.push(ms)});assert.equal(n,3);assert.equal(r.status,200);assert.deepEqual(waits,[2000,2000])});
test('permanent upstream error is not retried',async()=>{let n=0;const r=await fetchEvidence('https://example.test',{}, {fetcher:async()=>{n++;return new Response('',{status:400})},sleep:async()=>{}});assert.equal(n,1);assert.equal(r.status,400)});
test('network failures stop at three attempts',async()=>{let n=0;await assert.rejects(fetchEvidence('https://example.test',{}, {fetcher:async()=>{n++;throw Error('offline')},sleep:async()=>{}}));assert.equal(n,3)});
