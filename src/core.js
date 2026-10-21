export const defaultRubric = [
 {id:'titulo',label:'Título y objetivos',weight:15,rule:'Delimitación, pertinencia y correspondencia entre título, problema y objetivos.'},
 {id:'metodo',label:'Metodología',weight:25,rule:'Diseño, unidad de análisis, selección de casos, instrumentos y procedimiento reproducible. Adecuar al tipo de estudio.'},
 {id:'resultados',label:'Resultados y evidencia',weight:25,rule:'Datos verificables, cálculos coherentes y respuesta a los objetivos. Diferenciar resultados reales, sintéticos y esperados.'},
 {id:'discusion',label:'Discusión y conclusiones',weight:20,rule:'Interpretación fundamentada, limitaciones y conclusiones sustentadas sin extrapolaciones injustificadas.'},
 {id:'fuentes',label:'Fuentes y presentación',weight:15,rule:'Correspondencia entre citas y referencias, claridad, tablas y estructura. No inventar verificaciones bibliográficas.'}
];
export function validateRubric(r) {
 if(!Array.isArray(r)||!r.length||r.length>20||new Set(r.map(c=>c.id)).size!==r.length||r.some(c=>typeof c.id!=='string'||!c.id||typeof c.label!=='string'||!c.label.trim()||typeof c.rule!=='string'||!Number.isFinite(c.weight)||c.weight<=0)||Math.abs(r.reduce((s,c)=>s+c.weight,0)-100)>0.001) throw new Error('La rúbrica debe tener criterios únicos, pesos positivos y sumar 100 %.');
 return r;
}
export const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function score(criteria,rubric) {
 if(criteria.some(c=>c.score===null)) return null;
 return Math.round(rubric.reduce((s,r)=>s+(criteria.find(c=>c.id===r.id)?.score??0)*r.weight/100,0)*100)/100;
}
export function memoryFor(article,articles,rubric) {
 const tokens = new Set(normalize(article.text).match(/[a-z]{5,}/g)||[]);
 return articles.filter(a=>a.id!==article.id&&a.hash!==article.hash&&a.validated&&!a.holdout&&JSON.stringify(a.result?.rubric)===JSON.stringify(rubric)).map(a=>({a,rank:(a.career===article.career?20:0)+(normalize(a.title+' '+(a.validated.lesson||'')).match(/[a-z]{5,}/g)||[]).filter(t=>tokens.has(t)).length})).sort((a,b)=>b.rank-a.rank).slice(0,4).map(({a})=>({id:a.id,title:a.title,career:a.career,lesson:a.validated.lesson,criteria:a.validated.criteria,summary:a.result.summary}));
}
export function structural(text) {
 const t=normalize(text);const warnings=[];
 for(const [label,rx] of [['Resumen',/resumen|abstract/],['Metodología',/metodolog/],['Resultados',/resultados/],['Conclusiones',/conclusion/],['Referencias',/referencias|bibliograf/]]) if(!rx.test(t)) warnings.push(`No se encontró el encabezado ${label}. Verifica el texto extraído.`);
 if(/resultados esperados|se realizara|se desarrollara/.test(t)) warnings.push('Hay expresiones de trabajo futuro: comprobar si es una propuesta o un estudio ejecutado.');
 if(/sintetic|simulacion/.test(t)) warnings.push('Se mencionan datos sintéticos o simulación: comprobar su identificación y alcance.');
 if(/ignora.{0,40}instrucciones|no usar inteligencia artificial|respuesta sera orientad/.test(t)) warnings.push('Posible instrucción dirigida a una IA dentro del documento. Se trata como contenido, no como una orden.');
 return warnings;
}
export function parseEvaluation(raw,rubric,text) {
 let data;try{data=JSON.parse(raw.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));}catch{throw new Error('La IA no devolvió JSON válido. No se guardó una evaluación incompleta.');}
 if(typeof data.summary!=='string'||typeof data.studyType!=='string'||!Array.isArray(data.criteria)||data.criteria.length!==rubric.length) throw new Error('La respuesta de la IA está incompleta.');
 const norm=s=>String(s).replace(/\s+/g,' ').trim();
 const criteria=rubric.map(r=>{
 const c=data.criteria.find(c=>c.id===r.id);
 if(!c||typeof c.observation!=='string'||typeof c.suggestion!=='string'||!(c.score===null||(typeof c.score==='number'&&Number.isFinite(c.score)&&c.score>=0&&c.score<=10))) throw new Error('La IA devolvió criterios o notas inválidos.');
 const evidence=typeof c.evidence==='string'?c.evidence:'';
 return {id:r.id,score:c.score,observation:c.observation,suggestion:c.suggestion,evidence,evidenceVerified:!!evidence&&norm(text).includes(norm(evidence))};
 });
 return {summary:data.summary,studyType:data.studyType,criteria,score:score(criteria,rubric),rubric:structuredClone(rubric)};
}
export function validateBackup(b) {
 if(b?.version!==1||!Array.isArray(b.articles)||b.articles.length>5000) throw new Error('Respaldo incompatible.');validateRubric(b.rubric);
 for(const a of b.articles){if(typeof a.id!=='string'||typeof a.title!=='string'||typeof a.text!=='string'||a.text.length>500000||typeof a.hash!=='string'||typeof a.career!=='string')throw new Error('Artículo inválido en el respaldo.');
 if(a.result){validateRubric(a.result.rubric);parseEvaluation(JSON.stringify(a.result),a.result.rubric,a.text);}
 if(a.validated){if(!a.result||typeof a.validated.lesson!=='string'||!Array.isArray(a.validated.criteria)||a.validated.criteria.length!==a.result.rubric.length)throw new Error('Corrección inválida.');for(const r of a.result.rubric){const c=a.validated.criteria.find(c=>c.id===r.id);if(!c||!Number.isFinite(c.score)||c.score<0||c.score>10||typeof c.observation!=='string')throw new Error('Nota corregida inválida.');}}
 }
 if(new Set(b.articles.map(a=>a.id)).size!==b.articles.length)throw new Error('IDs duplicados en el respaldo.');return b;
}
