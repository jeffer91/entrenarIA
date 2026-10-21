import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultRubric as rubric,score,memoryFor,parseEvaluation,validateBackup,assessmentPairs,validateHuman} from '../src/core.js';
const sample=(scoreValue=8)=>({studyType:'Documental',summary:'Evaluación sustentada',criteria:rubric.map(r=>({id:r.id,score:scoreValue,observation:'El texto presenta evidencia.',evidence:'METODOLOGÍA',suggestion:'Explicar el procedimiento.'}))});
const article=(id,title,text,career='Redes')=>({id,title,text,career,hash:id,created:'2026-10-21T15:00:00Z',history:[],warnings:[],format:'TXT'});
function reviewed(a,grade=8){
 const result={...parseEvaluation(JSON.stringify(sample(grade)),rubric,a.text),model:'mock',provider:'gemini',at:'2026-10-21T15:00:00Z'};
 const validated={lesson:'Verificar la coherencia metodológica antes de puntuar.',criteria:rubric.map(r=>({id:r.id,score:grade,observation:'Validación humana justificada.'}))};
 return {...a,result,validated};
}
test('evidence verification tolerates capitalization, whitespace and accents',()=>{
 const r=parseEvaluation(JSON.stringify(sample()),rubric,'Introducción. Metodologia \n y evidencia.');
 assert.equal(r.criteria[0].evidenceVerified,true);
});
test('backups reject inconsistent total scores',()=>{
 const a=reviewed(article('a','Estudio A','METODOLOGÍA y resultados'));
 a.result.score=0;
 assert.throws(()=>validateBackup({version:1,rubric,articles:[a]}),/inconsistente/);
});
test('backups always recompute evidence verification flags',()=>{
 const a=reviewed(article('a','Estudio A','No existe el fragmento que afirma la IA'));
 a.result.criteria.forEach(c=>c.evidenceVerified=true);
 const imported=validateBackup({version:1,rubric,articles:[a]});
 assert.equal(imported.articles[0].result.criteria[0].evidenceVerified,false);
});
test('unrelated articles cannot enter the training context',()=>{
 const prior=reviewed(article('a','Sanidad hospitalaria','pacientes clínicos medicina enfermería infecciones','Enfermería'));
 const current=article('b','Métodos gravitatorios','física cuántica relatividad agujeros negros','Física');
 assert.deepEqual(memoryFor(current,[prior],rubric),[]);
});
test('renaming a criterion label preserves rubric-compatible training examples',()=>{
 const prior=reviewed(article('a','Protocolos de redes','METODOLOGÍA. Redes telecomunicaciones conexión fibras ópticas rendimiento','Redes'));
 const current=article('b','Conectividad urbana','La conexión de redes usa fibras ópticas y protocolos de telecomunicaciones.');
 const modified=rubric.map((r,i)=>i===0?{...r,label:'Título modificado'}:r);
 assert.deepEqual(memoryFor(current,[prior],modified).map(x=>x.id),['a']);
});
test('a validated historical version remains available while newest version is unvalidated',()=>{
 const orig=reviewed(article('a','Calidad de conexiones','METODOLOGÍA redes telecomunicaciones protocolos y latencia'));
 const candidate={...orig,history:[{result:orig.result,validated:orig.validated}],validated:null,result:{...orig.result,summary:'Segunda versión sin validar'}};
 const current=article('b','Eficiencia de conexión','Los protocolos de redes y latencia de telecomunicaciones requieren pruebas.');
 assert.deepEqual(memoryFor(current,[candidate],rubric).map(x=>x.id),['a']);
});
test('held-out articles never enter memory even if validated',()=>{
 const prior={...reviewed(article('a','Protocolos','METODOLOGÍA redes telecomunicaciones protocolos y latencia')),holdout:true};
 const target=article('b','Telecomunicación','Protocolos y redes con latencia');
 assert.deepEqual(memoryFor(target,[prior],rubric),[]);
});
test('a non-evaluable human criterion remains null and does not become zero',()=>{
 const a=reviewed(article('a','Ensayo','METODOLOGÍA'));
 a.validated.criteria[1].score=null;
 validateHuman(a.validated.criteria,rubric);
 assert.equal(score(a.validated.criteria,rubric),null);
 assert.equal(assessmentPairs([a])[0].human,null);
});
test('historical assessments contribute to statistics',()=>{
 const orig=reviewed(article('a','Ensayo','METODOLOGÍA'));
 const a={...orig,history:[{result:orig.result,validated:orig.validated}],result:{...orig.result,at:'2026-10-21T16:00:00Z'},validated:orig.validated};
 const result=assessmentPairs([a]);
 assert.equal(result.length,2);
 assert.equal(result[0].ai,8);
 assert.equal(result[1].human,8);
});
