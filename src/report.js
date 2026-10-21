import {score} from './core.js';
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const grade=x=>typeof x==='number'?x.toFixed(2).replace(/\.00$/,''):'No evaluable';
export function reportHtml(article) {
 const r=article.result;
 if(!r)throw new Error('Evalúa el artículo antes de generar un informe.');
 const human=article.validated,complete=human?score(human.criteria,r.rubric):null;
 const rows=r.rubric.map((criterion,index)=>{
   const ai=r.criteria.find(x=>x.id===criterion.id),adjusted=human?.criteria.find(x=>x.id===criterion.id);
   return '<section class="criterion"><h2>'+(index+1)+'. '+e(criterion.label)+' <small>('+criterion.weight+' %)</small></h2>'+
     '<p><strong>Calificación propuesta:</strong> '+grade(ai?.score)+' / 10</p>'+
     '<p><strong>Hallazgo:</strong> '+e(ai?.observation)+'</p>'+
     (ai?.evidence?'<p class="quote"><strong>Evidencia citada:</strong> '+e(ai.evidence)+' <em>('+ (ai.evidenceVerified?'localizada en el texto extraído':'no localizada: revisar') +')</em></p>':'<p><em>Sin fragmento literal citado; comprobar si la observación describe una ausencia.</em></p>')+
     '<p><strong>Recomendación:</strong> '+e(ai?.suggestion)+'</p>'+
     (adjusted?'<div class="human"><p><strong>Nota validada:</strong> '+grade(adjusted.score)+' / 10</p><p><strong>Observación definitiva:</strong> '+e(adjusted.observation)+'</p></div>':'')+
     '</section>';
 }).join('');
 const style='@page{size:A4;margin:19mm 18mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#1b2d42;font-size:10.5pt;line-height:1.48;margin:0}header{border-bottom:3px solid #344f7c;padding-bottom:12px;margin-bottom:25px}h1{font-size:19pt;margin:6px 0 8px}h2{font-size:12pt;margin:0 0 12px;color:#273e65}h2 small{color:#69798b;font-weight:normal}.label{font-size:9pt;color:#567;letter-spacing:.13em;text-transform:uppercase}small{font-size:9pt}p{margin:8px 0}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:12px;background:#f1f4f9;margin-bottom:16px}.summary{background:#f7f8fb;padding:12px 16px;margin:17px 0}.criterion{break-inside:avoid;border-bottom:1px solid #dce4eb;padding:15px 0}.quote{border-left:3px solid #748aaa;padding-left:12px;color:#3d4c60}.human{background:#edf7f3;padding:10px 12px}.warning{border-top:1px solid #dce4eb;font-size:8.5pt;color:#6b7480;margin-top:22px;padding-top:10px}footer{margin-top:20px;font-size:9pt;color:#677}';
 return '<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;;style-src &#39;unsafe-inline&#39;"><title>Informe EntrenarIA</title><style>'+style+'</style></head><body>'+
 '<header><div class="label">EntrenarIA · Informe de revisión académica</div><h1>'+e(article.title)+'</h1><p>'+e(article.career)+'</p></header>'+
 '<div class="meta"><div><strong>Modalidad:</strong> '+e(r.studyType)+'</div><div><strong>Evaluador IA:</strong> '+e(r.model||'Sin identificar')+'</div>'+
 '<div><strong>Etapa:</strong> '+e(r.reviewPhase||'Evaluación inicial')+'</div><div><strong>Fecha:</strong> '+e(new Date(r.at).toLocaleDateString('es-EC'))+'</div>'+
 '<div><strong>Nota propuesta:</strong> '+grade(r.score)+'</div><div><strong>Nota validada:</strong> '+(human?grade(complete):'Pendiente de revisión humana')+'</div></div>'+
 '<div class="summary"><h2>Resumen del análisis</h2><p>'+e(r.summary)+'</p></div>'+
 rows+(human?'<h2>Aprendizaje confirmado por el evaluador</h2><p>'+e(human.lesson)+'</p>':'')+
 '<p class="warning">Este informe es una herramienta de apoyo. La IA no certifica la autenticidad de los datos ni la existencia de las fuentes citadas. Los gráficos, tablas complejas y escaneos requieren revisión del documento original. La decisión académica final corresponde al evaluador humano.</p>'+
 '<footer>Generado por EntrenarIA · Historial almacenado localmente.</footer></body></html>';
}
