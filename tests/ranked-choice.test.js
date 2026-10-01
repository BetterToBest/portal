// Tests for the ranked-choice counting engine inside simulator/ranked/index.html.
// It pulls the engine out of the page (between the ENGINE-START and ENGINE-END markers),
// checks the four worked examples in docs/ranked-choice.md, the ballot parser and seed
// repeatability, then compares the engine with an independent brute-force counter on
// thousands of random electorates. Needs only Node 18 or later; nothing to install.
// Run from the repo root: node tests/ranked-choice.test.js simulator/ranked/index.html
const fs=require('fs');
const src=fs.readFileSync(process.argv[2]||'simulator/ranked/index.html','utf8');
const eng=src.split('/*ENGINE-START*/')[1].split('/*ENGINE-END*/')[0];
const E=new Function(eng+';return {parse,tally,step,explore,run,pairwise,mkrng,headToHead,lookback}')();
let fail=0; const ok=(c,m)=>{if(!c){fail++;console.log('FAIL',m)}else console.log('ok  ',m)};
const P=(t)=>E.parse(t);
const ex={
 ex1:"30: A\n28: B\n3: C\n3: D",
 ex2:"34: A\n30: B\n20: C > B\n12: D > C\n2: D > B\n2: D > A",
 ex3:"40: A\n25: B\n15: C > A\n15: D > A\n5: E > A",
 ex4:"50: A\n50: B"};
const go=(t,m,seed=1)=>{const p=P(t);if(p.errs.length)throw new Error(p.errs);return {p,r:E.run(p.groups,p.cands,m,E.mkrng(seed))}};
// Example 1
let {p,r}=go(ex.ex1,'election');
ok(r.status==='winner'&&r.winner==='a','ex1 A wins');
let L=r.rounds[r.rounds.length-1];
ok(L.counts.a===30&&L.counts.b===28&&L.exhausted===6,'ex1 A30 B28 exhausted 6');
ok(r.rounds[0].rule==='batch'&&r.rounds[0].elim.join()==='c,d','ex1 batch C,D');
ok(r.ties.length===0,'ex1 no tie');
// Example 2
({p,r}=go(ex.ex2,'advisory'));
ok(r.status==='tied'&&r.tie.possible.slice().sort().join()==='a,b','ex2 advisory tied A/B');
const br=Object.fromEntries(r.tie.branches.map(b=>[b.elim,b]));
ok(br.b.winners[0]==='a'&&br.b.fin.counts.a===36&&br.b.fin.counts.c===32,'ex2 elim B -> A 36, C 32');
ok(br.c.winners[0]==='b'&&br.c.fin.counts.b===52&&br.c.fin.counts.a===36,'ex2 elim C -> B 52, A 36');
({p,r}=go(ex.ex2,'election'));
ok(r.status==='winner'&&r.winner==='b'&&r.ties[0].resolved.rule==='lookback'&&r.ties[0].resolved.elim==='c','ex2 election look-back eliminates C, B wins');
ok(r.ties[0].lookback.trail[0].round===1,'ex2 look-back reads round 1');
// Example 3
for(const m of ['advisory','election']){({p,r}=go(ex.ex3,m));
 L=r.rounds[r.rounds.length-1];
 ok(r.status==='winner'&&r.winner==='a'&&L.counts.a===60,'ex3 '+m+' A wins with 60');
 ok(r.ties.length===1&&r.ties[0].matters===false&&r.ties[0].tied.join()==='c,d','ex3 '+m+' tie C/D harmless');}
// Example 4
({p,r}=go(ex.ex4,'advisory'));
ok(r.status==='tied'&&r.tie.possible.length===2,'ex4 advisory tied');
({p,r}=go(ex.ex4,'election',1)); const w1=r.winner; ok(r.ties[0].resolved.rule==='draw','ex4 election uses draw');
({p,r}=go(ex.ex4,'election',1)); ok(r.winner===w1,'ex4 draw repeatable with same seed');
let seen=new Set(); for(let s=1;s<=40;s++){seen.add(go(ex.ex4,'election',s).r.winner)} ok(seen.size===2,'ex4 draw reaches both outcomes across seeds');
// Parsing
ok(P('abc').errs.length===1,'parse: bad line'); ok(P('5: A > B > A').groups[0].r.join()==='a,b','parse: repeat counts once');
ok(P('5: A').errs.length===1,'parse: one candidate rejected'); ok(P('0: A\n3: B').errs.length>0,'parse: zero count rejected');
ok(P('5: constructor > B').errs.length===0,'parse: odd name ok'); ok(P('5: A_1 > B').errs.length===1,'parse: bad char');
ok(P('1: a > B\n1: A > b').cands.length===2,'parse: case-insensitive merge');

// Fuzz vs naive reference (no batch elimination, branch every tie)
function naive(groups,alive,memo={}){
  const key=alive.join();if(memo[key])return memo[key];
  const t=E.tally(groups,alive);let cont=0;alive.forEach(k=>cont+=t.counts[k]);
  let out;
  if(cont===0)out=new Set([null]);
  else{const top=alive.reduce((a,b)=>t.counts[b]>t.counts[a]?b:a);
    if(t.counts[top]*2>cont)out=new Set([top]);
    else{const low=Math.min(...alive.map(k=>t.counts[k]));out=new Set();
      alive.filter(k=>t.counts[k]===low).forEach(x=>naive(groups,alive.filter(c=>c!==x),memo).forEach(w=>out.add(w)));}}
  memo[key]=out;return out;}
let rng=E.mkrng(12345),tested=0,ties=0,mism=0,bad=0;
const names='abcdefg';
for(let it=0;it<4000;it++){
  const nc=2+Math.floor(rng()*5),cs=names.slice(0,nc).split('');
  const ng=1+Math.floor(rng()*8),groups=[];
  for(let g=0;g<ng;g++){const len=1+Math.floor(rng()*nc);const pool=cs.slice();const r=[];for(let i=0;i<len;i++){r.push(pool.splice(Math.floor(rng()*pool.length),1)[0])}
    groups.push({n:1+Math.floor(rng()*(rng()<.5?6:40)),r});}
  const cands=[...new Set(groups.flatMap(g=>g.r))].sort(); if(cands.length<2)continue;
  const ref=[...naive(groups,cands)].sort().join();
  const adv=E.run(groups,cands,'advisory',E.mkrng(1));
  const ele=E.run(groups,cands,'election',E.mkrng(it+1));
  tested++; if(adv.ties.length)ties++;
  const poss=adv.status==='tied'?adv.tie.possible.slice().sort().join():adv.winner;
  // advisory: when it ends tied, ref must hold >1 winner possible at that point; when winner, must be inside ref set
  if(adv.status==='winner'&&!ref.split(',').includes(adv.winner))mism++;
  if(adv.status==='tied'&&ref.split(',').length<2)mism++;
  if(ref.split(',').length===1&&adv.status!=='winner'&&adv.status!=='none')mism++;
  if(ele.status==='winner'&&!ref.split(',').includes(ele.winner))mism++;
  if(ele.status!=='winner'&&ele.status!=='none')bad++;
  // an exactly-one-possible-winner electorate must give the same winner in both modes
  if(ref.split(',').length===1&&ele.winner!==adv.winner)mism++;
}
ok(mism===0&&bad===0,`fuzz ${tested} electorates (${ties} with ties): ${mism} mismatches, ${bad} unfinished`);
process.exit(fail||mism||bad?1:0);
