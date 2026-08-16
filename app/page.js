'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function Pill({ value }) {
  const v = value || '—';
  const cls = ['CONTENT_LOCKED','APPROVED','PASS'].includes(v) ? 'pill green' : ['ERROR','REJECTED','FAIL'].includes(v) ? 'pill red' : v === 'RUNNING' ? 'pill blue' : ['NEEDS_RESEARCH','NEEDS_REVISION','NEEDS_HUMAN_REVIEW','HOLD','PENDING'].includes(v) ? 'pill yellow' : 'pill';
  return <span className={cls}>{v}</span>;
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total:0, running:0, review:0, locked:0, errors:0 });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('claims');
  const [loading, setLoading] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newPillar, setNewPillar] = useState('');
  const [newPriority, setNewPriority] = useState(80);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function api(fn, body) {
    const token = session?.access_token;
    if (!token) throw new Error('Not signed in');
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}`, apikey:SUPABASE_KEY },
      body: JSON.stringify(body || {})
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  }

  async function loadAll() {
    if (!session) return;
    setLoading(true);
    try {
      const d = await api('content-data', { mode:'LIST' });
      setItems(d.items || []); setSummary(d.summary || {});
      if (selectedId && (d.items || []).some(x => x.id === selectedId)) await selectItem(selectedId);
    } finally { setLoading(false); }
  }

  // No polling: fetch once after sign-in, then only on explicit user actions such as Refresh.
  useEffect(() => {
    if (!session) return;
    loadAll();
  }, [session]);

  async function signIn() {
    setAuthMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthMsg(error.message);
  }
  async function signUp() {
    setAuthMsg('');
    if (password.length < 6) return setAuthMsg('Password must be at least 6 characters.');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthMsg(error.message); else if (!data.session) setAuthMsg('Account created. Confirm your email, then sign in.');
  }
  async function signOut() { await supabase.auth.signOut(); setItems([]); setDetail(null); setSelectedId(null); }

  async function createContent() {
    if (!newTopic.trim()) return;
    const d = await api('content-control', { action:'CREATE_CONTENT', topic:newTopic.trim(), content_pillar:newPillar.trim()||null, priority_score:Number(newPriority||0) });
    setNewTopic(''); await loadAll(); await selectItem(d.content.id);
  }
  async function selectItem(id) { setSelectedId(id); setDetail(await api('content-data',{mode:'DETAIL',id})); }
  async function act(action) { if (!selectedId) return; await api('content-control',{action,id:selectedId}); await loadAll(); }

  const activeTabData = useMemo(() => detail?.[tab] || [], [detail, tab]);

  if (!session) return <main className="authWrap"><section className="authCard"><h1>Content Control Center</h1><p>Phase-1 · Evidence-backed content operations</p><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email"/></label><label>Password<input value={password} onChange={e=>setPassword(e.target.value)} type="password"/></label><button className="primary" onClick={signIn}>Sign in</button><button className="secondary" onClick={signUp}>Create account</button>{authMsg && <div className="message">{authMsg}</div>}</section></main>;

  const item = detail?.item;
  return <main>
    <header className="top"><div className="brand">Content Control Center <span>Phase-1 V1</span></div><div className="topRight"><span>{session.user.email}</span><button onClick={loadAll}>Refresh</button><button onClick={signOut}>Sign out</button></div></header>
    <div className="wrap"><div className="statusbar">{loading ? 'Refreshing…' : 'Connected to Supabase backend · Auto-refresh OFF'}</div>
    <section className="summary">{[['Total',summary.total],['Running',summary.running],['Review',summary.review],['Locked',summary.locked],['Errors',summary.errors]].map(([k,v])=><div className="card" key={k}><div className="metric">{v??0}</div><div className="metricLabel">{k}</div></div>)}</section>
    <section className="card create"><h3>New Content</h3><div className="newbox"><input placeholder="Topic, e.g. Type 2 Diabetes" value={newTopic} onChange={e=>setNewTopic(e.target.value)}/><input placeholder="Content pillar (optional)" value={newPillar} onChange={e=>setNewPillar(e.target.value)}/><input type="number" min="0" max="100" value={newPriority} onChange={e=>setNewPriority(e.target.value)}/><button className="primary" onClick={createContent}>+ Create</button></div></section>
    <section className="layout"><div className="panel"><div className="panelHead"><h2>Pipeline Board</h2></div><div className="tableWrap"><table><thead><tr><th>ID</th><th>Topic</th><th>Stage</th><th>Agent</th><th>Evidence</th><th>Safety</th><th>Content</th><th>Status</th></tr></thead><tbody>{items.length?items.map(x=><tr key={x.id} onClick={()=>selectItem(x.id)} className={selectedId===x.id?'selectedRow':''}><td><b>{x.content_id}</b></td><td>{x.topic}</td><td>{x.current_stage}</td><td>{x.current_agent||'—'}</td><td>{x.evidence_score??'—'}</td><td>{x.safety_score??'—'}</td><td>{x.overall_content_score??'—'}</td><td><Pill value={x.overall_status}/></td></tr>):<tr><td colSpan="8" className="empty">No content yet.</td></tr>}</tbody></table></div></div>
    <div className="panel"><div className="panelHead"><h2>Content Detail</h2><span>{item?.content_id||''}</span></div>{!item?<div className="empty">Select a content item.</div>:<><div className="detail"><h3>{item.topic}</h3><Pill value={item.overall_status}/><div className="kv"><span>Stage</span><b>{item.current_stage}</b><span>Agent</span><b>{item.current_agent||'—'}</b><span>Evidence gate</span><Pill value={item.evidence_gate}/><span>Safety gate</span><Pill value={item.safety_gate}/><span>Content QA</span><Pill value={item.content_qa_gate}/><span>Human review</span><Pill value={item.human_medical_review}/><span>Content lock</span><Pill value={item.content_lock}/></div><div className="actions"><button className="primary" onClick={()=>act('RUN_CONTENT_ENGINE')}>▶ Run</button><button onClick={()=>act('HOLD')}>⏸ Hold</button><button onClick={()=>act('RESEARCH_AGAIN')}>↻ Research Again</button><button onClick={()=>act('REVISE')}>✎ Revise</button><button onClick={()=>act('APPROVE_CONTENT')}>✓ Approve</button><button className="danger" onClick={()=>act('REJECT_CONTENT')}>Reject</button><button onClick={()=>act('LOCK_CONTENT')}>🔒 Lock</button></div></div><div className="tabs">{['claims','sources','scripts','runs'].map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?'active':''}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div><div className="tabbody">{activeTabData.length?activeTabData.map((x,i)=><div className="claim" key={x.id||i}><div className="claimTitle">{tab==='claims'?`${x.claim_id} · ${x.claim_text_master}`:tab==='sources'?x.title:tab==='scripts'?`${x.language} · Version ${x.version}`:`${x.mode} · ${x.status}`}</div><div className="claimMeta">{tab==='claims'?`Evidence: ${x.evidence_level} · Risk: ${x.risk_level} · ${x.allowed_in_script?'Allowed':'Blocked'}`:tab==='sources'?`${x.publisher||''} · ${x.source_type} · ${x.evidence_strength}`:tab==='scripts'?x.status:`Node: ${x.current_node||'—'}`}</div></div>):<div className="empty">No {tab} yet.</div>}</div></>}</div></section></div>
  </main>;
}
