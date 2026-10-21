export const defaultRubric = [
  {id:'titulo',label:'Título y objetivos',weight:15,rule:'Delimitación, pertinencia y correspondencia entre título, problema y objetivos.'},
  {id:'metodo',label:'Metodología',weight:25,rule:'Diseño, unidad de análisis, selección de casos, instrumentos y procedimiento reproducible. Adecuar al tipo de estudio.'},
  {id:'resultados',label:'Resultados y evidencia',weight:25,rule:'Datos verificables, cálculos coherentes y respuesta a los objetivos. Diferenciar resultados reales, sintéticos y esperados.'},
  {id:'discusion',label:'Discusión y conclusiones',weight:20,rule:'Interpretación fundamentada, limitaciones y conclusiones sustentadas sin extrapolaciones injustificadas.'},
  {id:'fuentes',label:'Fuentes y presentación',weight:15,rule:'Correspondencia entre citas y referencias, claridad, tablas y estructura. No inventar verificaciones bibliográficas.'}
];
export const normalize = s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const normalizeEvidence = s=>normalize(s).replace(/\s+/g,' ').trim();
export function validateRubric(r) {
  if(!Array.isArray(r)||r.length<1||r.length>20)throw new Error('La rúbrica debe contener entre 1 y 20 criterios.');
  if(r.some(x=>!x||typeof x.id!=='string'||!/^[-a-z0-9_]{1,40}$/i.test(x.id)||typeof x.label!=='string'||!x.label.trim()||x.label.length>140||typeof x.rule!=='string'||!x.rule.trim()||x.rule.length>3000||typeof x.weight!=='number'||!Number.isFinite(x.weight)||x.weight<=0||x.weight>100))throw new Error('La rúbrica contiene un criterio inválido.');
  if(new Set(r.map(x=>x.id)).size!==r.length||Math.abs(r.reduce((s,x)=>s+x.weight,0)-100)>0.001)throw new Error('La rúbrica debe tener criterios únicos, pesos positivos y sumar 100 %.');
  return r;
}
export function score(criteria,rubric) {
  if(!Array.isArray(criteria)||!Array.isArray(rubric))return null;
  const grades=rubric.map(r=>criteria.find(c=>c.id===r.id)?.score);
  if(grades.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>10))return null;
  return Math.round(rubric.reduce((sum,r,i)=>sum+grades[i]*r.weight/100,0)*100)/100;
}
function tokens(s) {
  const common=new Set('sobre entre desde hasta donde tanto cuando porque cuales cual cuyo para como esta este estos estas unos unas hacia junto mediante segun forma estudio estudios articulo articulos investigacion investigaciones analisis evaluacion metodologia resultados conclusion conclusiones objetivo objetivos propuesta trabajo trabajos datos informacion proceso procesos los las del por con una unos uno que este cual han sido estas sus mas menos todo toda cuya deben debe puede cada metodo documentada registro general'.split(' '));
  return new Set((normalize(s).match(/[a-z]{4,}/g)||[]).filter(w=>!common.has(w)).slice(0,7000));
}
function intersection(a,b) {let n=0;for(const t of a)if(b.has(t))n++;return n;}
function similarity(a,b) {const hits=intersection(a,b);return hits/(a.size+b.size-hits||1);}
function candidateRubricCompatible(a,b) {
  // Cosmetic label edits do not invalidate learning; criteria, weights and standards must agree.
  return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(x=>{
    const y=b.find(z=>z.id===x.id);
    return !!y&&x.weight===y.weight&&normalizeEvidence(x.rule)===normalizeEvidence(y.rule);
  });
}
function latestApproved(a) {
  if(a.validated&&a.result)return {result:a.result,validated:a.validated};
  return (a.history||[]).slice().reverse().find(h=>h.validated&&h.result)||null;
}
export function memoryFor(article,articles,rubric) {
  const src=tokens(String(article.text||'').slice(0,28000)+String(article.text||'').slice(-8000));
  const head=tokens(article.title);
  return articles.map(a=>{
    if(a.id===article.id||a.hash===article.hash||a.holdout)return null;
    const approved=latestApproved(a);
    if(!approved||!candidateRubricCompatible(approved.result.rubric,rubric))return null;
    const body=tokens(String(a.text||'').slice(0,28000)+String(a.text||'').slice(-8000));
    const title=tokens(a.title),common=intersection(src,body),bodySim=similarity(src,body),titleSim=similarity(head,title);
    if(bodySim>=0.8||(titleSim>=0.88&&bodySim>=0.3))return null; // avoid near-revisions
    const semanticEvidence=common+intersection(src,tokens(approved.validated.lesson||''))+intersection(head,title);
    if(!semanticEvidence)return null; // never substitute an unrelated article just to fill four slots
    if(bodySim<0.009&&titleSim===0&&intersection(src,tokens(approved.validated.lesson||''))===0)return null;
    const rank=bodySim*70+titleSim*18+(a.career===article.career?6:0)+intersection(src,tokens(approved.validated.lesson||''))*0.6;
    return {a,approved,rank};
  }).filter(Boolean).sort((a,b)=>b.rank-a.rank).slice(0,4).map(({a,approved})=>({
    id:a.id,title:a.title,career:a.career,
    lesson:approved.validated.lesson.slice(0,2500),
    criteria:approved.validated.criteria.map(c=>({id:c.id,score:c.score,observation:c.observation.slice(0,1400)})),
    summary:(approved.result.summary||'').slice(0,1200)
  }));
}
export function structural(text) {
  const t=normalize(text), warnings=[];
  const sections=[['Resumen',/\b(resumen|abstract)\s*[:.\n]/],['Metodología',/\b(metodologia|materiales y metodos|metodos)\s*[:.\n]/],['Resultados',/\bresultados\s*[:.\n]/],['Conclusiones',/\bconclusiones\s*[:.\n]/],['Referencias',/\b(referencias|bibliografia)\s*[:.\n]/]];
  for(const [label,rx] of sections)if(!rx.test(t))warnings.push('No se reconoció un encabezado de '+label+'. Revisa el original; la extracción puede alterar el formato.');
  if(/resultados esperados|se realizara|se desarrollara/.test(t))warnings.push('Hay expresiones de trabajo futuro: comprobar si se trata de una propuesta o de un estudio ejecutado.');
  if(/sintetic|simulacion/.test(t))warnings.push('Se mencionan datos sintéticos o simulación: verificar que las conclusiones no se presenten como datos de campo.');
  if(/ignora.{0,40}instrucciones|no usar inteligencia artificial|respuesta sera orientad/.test(t))warnings.push('Posible instrucción dirigida a un modelo de IA dentro del documento. Tratar como contenido no confiable.');
  return warnings;
}
export function parseEvaluation(raw,rubric,text) {
  validateRubric(rubric);
  let data;
  try{data=JSON.parse(String(raw).replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch{throw new Error('La IA no devolvió JSON válido. La evaluación anterior se conservó.');}
  if(!data||typeof data.summary!=='string'||!data.summary.trim()||typeof data.studyType!=='string'||!data.studyType.trim()||!Array.isArray(data.criteria)||data.criteria.length!==rubric.length)throw new Error('La respuesta de la IA está incompleta.');
  const criteria=rubric.map(r=>{
    const c=data.criteria.find(x=>x?.id===r.id);
    if(!c||typeof c.observation!=='string'||!c.observation.trim()||typeof c.suggestion!=='string'||!(c.score===null||(typeof c.score==='number'&&Number.isFinite(c.score)&&c.score>=0&&c.score<=10)))throw new Error('La IA devolvió criterios o notas inválidos.');
    const evidence=typeof c.evidence==='string'?c.evidence.slice(0,1300):'';
    return {id:r.id,score:c.score,observation:c.observation.slice(0,6000),suggestion:c.suggestion.slice(0,6000),evidence,evidenceVerified:!!evidence&&normalizeEvidence(text).includes(normalizeEvidence(evidence))};
  });
  return {summary:data.summary.slice(0,8000),studyType:data.studyType.slice(0,500),criteria,score:score(criteria,rubric),rubric:structuredClone(rubric)};
}
export function validateHuman(criteria,rubric) {
  if(!Array.isArray(criteria)||criteria.length!==rubric.length)throw new Error('Evaluación humana incompleta.');
  for(const r of rubric){
    const c=criteria.find(x=>x?.id===r.id);
    if(!c||!(c.score===null||(typeof c.score==='number'&&Number.isFinite(c.score)&&c.score>=0&&c.score<=10))||typeof c.observation!=='string'||!c.observation.trim()||c.observation.length>12000)throw new Error('La corrección humana tiene una nota u observación inválida.');
  }
  return criteria;
}
function verifyAssessment(res,text) {
  if(!res||typeof res!=='object')throw new Error('Evaluación ausente.');
  validateRubric(res.rubric);
  const parsed=parseEvaluation(JSON.stringify(res),res.rubric,text);
  if(res.score!==parsed.score)throw new Error('El respaldo contiene una nota total inconsistente con sus criterios.');
  return {...res,summary:parsed.summary,studyType:parsed.studyType,criteria:parsed.criteria,score:parsed.score,rubric:parsed.rubric};
}
export function validateBackup(b) {
  if(b?.version!==1||!Array.isArray(b.articles)||b.articles.length>5000)throw new Error('Respaldo incompatible.');
  validateRubric(b.rubric);
  const ids=new Set();
  const articles=b.articles.map(a=>{
    if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id)||typeof a.title!=='string'||!a.title.trim()||typeof a.text!=='string'||a.text.length>120000||typeof a.hash!=='string'||typeof a.career!=='string'||!Array.isArray(a.history||[])||(a.history||[]).length>100)throw new Error('Artículo inválido en el respaldo.');
    ids.add(a.id);
    const result=a.result?verifyAssessment(a.result,a.text):null;
    let validated=null;
    if(a.validated){
      if(!result||typeof a.validated.lesson!=='string'||!a.validated.lesson.trim())throw new Error('La lección humana del respaldo está incompleta.');
      validated={...a.validated,criteria:validateHuman(a.validated.criteria,result.rubric)};
    }
    const history=(a.history||[]).map(h=>{
      if(!h?.result)throw new Error('Historial inválido.');
      const previous=verifyAssessment(h.result,a.text);
      if(h.validated){
        if(typeof h.validated.lesson!=='string'||!h.validated.lesson.trim())throw new Error('Lección histórica inválida.');
        return {...h,result:previous,validated:{...h.validated,criteria:validateHuman(h.validated.criteria,previous.rubric)}};
      }
      return {...h,result:previous,validated:null};
    });
    return {...a,result,validated,history,holdout:!!a.holdout};
  });
  return {...b,articles};
}
export function assessmentPairs(articles) {
  const pairs=[];
  for(const a of articles) {
    const versions=[...(a.history||[]),{result:a.result,validated:a.validated}];
    for(const h of versions){
      if(!h.result||!h.validated)continue;
      const ai=h.result.score,human=score(h.validated.criteria,h.result.rubric);
      pairs.push({id:a.id,title:a.title,holdout:!!a.holdout,model:h.result.model||'Sin modelo',at:h.result.at||a.created,ai,human,criteria:h.result.rubric.map(r=>{
        const orig=h.result.criteria.find(c=>c.id===r.id)?.score;
        const corrected=h.validated.criteria.find(c=>c.id===r.id)?.score;
        return {id:r.id,label:r.label,ai:orig,human:corrected,delta:typeof orig==='number'&&typeof corrected==='number'?Math.abs(orig-corrected):null};
      })});
    }
  }
  return pairs;
}
