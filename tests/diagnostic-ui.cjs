const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const puppeteer=require('puppeteer-core');
const JSZip=require('jszip');
const {PDFDocument,StandardFonts}=require('pdf-lib');

const electron=process.env.TARGET==='electron';
const log=(name,msg='')=>console.log('AUDIT_PASS '+name+(msg?' | '+msg:''));
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const text='Resumen. Estudio documental sobre evaluación académica y políticas institucionales. '.repeat(12)+' Metodología. Se analizaron documentos institucionales mediante una matriz de categorías. Resultados. Se identificaron tres criterios de mejora verificables. Conclusiones. La evidencia revisada permite mejorar la evaluación. Referencias. Autor, A. (2024). Documento de prueba.';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'entrenaria-audit-'));
const txt=path.join(temp,'audit-fixture.txt');
const pdf=path.join(temp,'audit-fixture.pdf');
const docx=path.join(temp,'audit-fixture.docx');
fs.writeFileSync(txt,text);

async function createFiles(){
 const p=await PDFDocument.create(), font=await p.embedFont(StandardFonts.Helvetica), page=p.addPage([612,792]);
 const lines=[...text.matchAll(/.{1,78}(?:\s|$)/g)].map(x=>x[0]).slice(0,34);
 lines.forEach((line,i)=>page.drawText(line.trim().replace(/[^\x20-\x7E]/g,' '),{x:40,y:740-i*17,size:9,font}));
 fs.writeFileSync(pdf,await p.save());
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const paragraphs=text.match(/.{1,140}/g).map(s=>'<w:p><w:r><w:t>'+s.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</w:t></w:r></w:p>').join('');
 zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'</w:body></w:document>');
 fs.writeFileSync(docx,await zip.generateAsync({type:'nodebuffer'}));
}
function timeoutPromise(p,ms,label){return Promise.race([p,delay(ms).then(()=>{throw new Error('Timeout '+label)})]);}
async function startBrowser(){
 if(electron){
  return timeoutPromise((async()=>{while(true){try{const browser=await puppeteer.connect({browserURL:'http://127.0.0.1:9223',defaultViewport:null});const pages=await browser.pages();const page=pages.find(p=>p.url().includes('index.html'));if(page)return {browser,page,child:null};}catch{}await delay(400);}})(),45000,'Electron CDP');
 }
 const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
 const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',b=>{stderr+=b.toString()});
 await timeoutPromise((async()=>{while(true){try{const r=await fetch('http://127.0.0.1:4173/');if(r.ok)break;}catch{}await delay(300);}})(),20000,'Vite preview '+stderr);
 const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle0'});
 return {browser,page,child};
}
async function button(page,selector){await page.waitForSelector(selector,{visible:true,timeout:15000});await page.click(selector);}
async function value(page,selector,value){await page.waitForSelector(selector);await page.$eval(selector,(el,x)=>{el.value=x;el.dispatchEvent(new Event('input',{bubbles:true}));},value)}
async function contains(page,s){const body=await page.$eval('body',e=>e.innerText);assert(body.includes(s),'No aparece "'+s+'"');}
async function ensureSaved(page){await delay(350)}
async function makeText(page,title,content=text){
 await button(page,'[data-page="evaluar"]');
 await value(page,'#manual-title',title);
 await value(page,'#manual-text',content+' Identificador de revisión: '+title+'.');
 await value(page,'#career','Redes y Telecomunicaciones');
 await button(page,'[data-action="manual"]');
 await page.waitForSelector('.detail-actions',{timeout:15000});
 await contains(page,title);
}
async function upload(page,file){
 await button(page,'[data-page="evaluar"]');
 const upload=await page.$('#upload');
 await upload.uploadFile(file);
 await page.waitForFunction(name=>document.body.innerText.includes(name),{timeout:22000},path.basename(file).replace(/\.[^.]+$/,''));
}
async function main(){
 await createFiles();
 let ollamaMock=null;
 if(electron){
  ollamaMock=http.createServer(async(req,res)=>{
   try{
    if(req.url!=='/api/generate'||req.method!=='POST'){res.writeHead(404).end();return;}
    let body='';for await(const part of req)body+=part;
    const data=JSON.parse(body), prompt=JSON.parse(data.prompt);
    const result={studyType:'Análisis documental técnico',summary:'Respuesta local simulada para probar IPC Ollama.',criteria:prompt.rubric.map(x=>({id:x.id,score:8,observation:'Evaluación local de '+x.label,evidence:'Metodología',suggestion:'Aportar evidencia verificable'}))};
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({response:JSON.stringify(result)}));
   }catch(e){res.writeHead(500).end(String(e))}
  });
  await new Promise((resolve,reject)=>{ollamaMock.once('error',reject);ollamaMock.listen(11434,'127.0.0.1',resolve)});
 }

 const {browser,page,child}=await startBrowser();
 const errors=[];
 page.on('pageerror',e=>errors.push('js:'+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text().slice(0,160))});
 page.on('dialog',async d=>{await d.accept()});
 if(electron) await page.waitForSelector('nav',{timeout:20000});
 else await page.waitForSelector('nav');
 log('interface_loaded',page.url());
 await button(page,'[data-page="rubrica"]');
 await contains(page,'Tu rúbrica');
 await value(page,'[name="weight0"]','99');
 await button(page,'#rubric-form button');
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.includes('sumar 100'),{timeout:4000});
 log('invalid_rubric_rejected');
 await value(page,'[name="weight0"]','15');
 await button(page,'#rubric-form button');
 await ensureSaved(page);
 log('rubric_save');
 await upload(page,txt); log('import_txt');
 await upload(page,pdf); log('import_pdf');
 await upload(page,docx); log('import_docx');
 await makeText(page,'Auditoría semántica número uno');
 log('manual_import');
 await button(page,'[data-action="evaluate"]');
 await contains(page,'Configura tu espacio');
 log('no_ai_configuration_route');
 await value(page,'[name="model"]','gemini-2.5-flash');
 await value(page,'[name="key"]','test-key-not-real');
 await button(page,'#config-form button');
 await ensureSaved(page);
 await button(page,'[data-page="biblioteca"]');
 await page.waitForSelector('[data-open]');
 const selector=await page.evaluate(()=>{const n=[...document.querySelectorAll('[data-open]')].find(e=>e.innerText.includes('Auditoría semántica número uno'));return n?.getAttribute('data-open')});
 assert(selector,'Not in library');
 await button(page,'[data-open="'+selector+'"]');
 await page.evaluate(()=>{
  const original=window.fetch;
  window.fetch=(url,opts)=>{
   if(String(url).includes('generativelanguage.googleapis.com')){
    const req=JSON.parse(opts.body),user=JSON.parse(req.contents[0].parts[0].text);
    const result={studyType:'Documental',summary:'Análisis simulado para verificar la interfaz, NO una evaluación de IA real.',criteria:user.rubric.map(r=>({id:r.id,score:8,observation:'Observación de prueba '+r.label,evidence:'Metodología',suggestion:'Detallar el procedimiento'}))};
    return Promise.resolve(new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]}),{status:200,headers:{'Content-Type':'application/json'}}));
   }
   return original(url,opts);
  };
 });
 await button(page,'[data-action="evaluate"]');
 await page.waitForSelector('#validation-form',{timeout:16000});
 log('ai_api_contract_mock');
 await value(page,'[name="lesson"]','La evidencia debe corresponder a la metodología; no inventar resultados.');
 await button(page,'#validation-form button');
 await ensureSaved(page);
 await contains(page,'Actualizar evaluación validada');
 log('human_validation');
 await button(page,'[data-page="memoria"]');
 await contains(page,'Auditoría semántica número uno');
 log('validated_memory');
 await makeText(page,'Auditoría semántica número dos',text.replace('estudio documental','análisis documental ampliado'));
 await page.evaluate(()=>{
  const original=window.fetch;
  window.fetch=(url,opts)=>{
   if(String(url).includes('generativelanguage.googleapis.com')){
    const user=JSON.parse(JSON.parse(opts.body).contents[0].parts[0].text);
    const result={studyType:'Documental',summary:'Segunda evaluación simulada. Memorias:'+user.validatedExamples.length,criteria:user.rubric.map(r=>({id:r.id,score:7,observation:'Segunda observación '+r.label,evidence:'Metodología',suggestion:'Describir limitaciones'}))};
    return Promise.resolve(new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]}),{status:200,headers:{'Content-Type':'application/json'}}));
   }
   return original(url,opts);
  };
 });
 await button(page,'[data-action="evaluate"]');
 await page.waitForSelector('#validation-form');
 const summary=await page.$eval('.evaluation',e=>e.innerText);
 console.log('AUDIT_MEMORY '+JSON.stringify({summary:summary.slice(0,250)}));
 assert(summary.includes('Memorias:0'),'Una versión casi idéntica no debe entrar como aprendizaje.');
 log('near_duplicate_memory_excluded');
 await value(page,'[name="lesson"]','La metodología debe ser verificable.');
 await button(page,'#validation-form button');
 await ensureSaved(page);
 // Third study deliberately differs: memory must recover previously validated cases.
 const thirdText=('Resumen. Se estudia la mejora de procesos de telecomunicaciones a través de una comparación documental de protocolos de mantenimiento. Metodología. Revisión de indicadores de conectividad, registros técnicos y tiempos de respuesta. Resultados. Se compararon cuatro procedimientos y se detallaron sus limitaciones. Conclusiones. Los protocolos técnicos pueden auditarse con evidencias documentadas. Referencias. Autor 2025. ').repeat(6);
 await makeText(page,'Estudio independiente de protocolos',thirdText);
 await page.$eval('#holdout',el=>el.click());
 await page.waitForFunction(()=>document.querySelector('#holdout')?.checked);
 await page.evaluate(()=>{
  const original=window.fetch;
  window.fetch=(url,opts)=>{
   if(String(url).includes('generativelanguage.googleapis.com')){
    const user=JSON.parse(JSON.parse(opts.body).contents[0].parts[0].text);
    const result={studyType:'Documental',summary:'Tercera evaluación simulada. Memorias:'+user.validatedExamples.length,criteria:user.rubric.map(r=>({id:r.id,score:9,observation:'Caso independiente '+r.label,evidence:'Metodología',suggestion:'Precisar evidencia documental'}))};
    return Promise.resolve(new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]}),{status:200,headers:{'Content-Type':'application/json'}}));
   }
   return original(url,opts);
  };
 });
 await button(page,'[data-action="evaluate"]');
 await page.waitForSelector('#validation-form');
 const thirdSummary=await page.$eval('.evaluation',e=>e.innerText);
 assert(/Memorias:[1-4]/.test(thirdSummary),'Una revisión independiente no recuperó memoria validada.');
 log('independent_study_recovers_memory',thirdSummary.match(/Memorias:[1-4]/)?.[0]);
 await value(page,'[name="lesson"]','La evaluación debe atender a los protocolos técnicos y sus limitaciones.');
 await button(page,'#validation-form button');
 await ensureSaved(page);
 // Malformed model responses must not destroy an approved evaluation.
 await page.evaluate(()=>{
  const original=window.fetch;
  window.fetch=(url,options)=>String(url).includes('generativelanguage.googleapis.com')
   ? Promise.resolve(new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:'not valid JSON'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}}))
   : original(url,options);
 });
 await button(page,'[data-action="evaluate"]');
 await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.includes('JSON válido'),{timeout:12000});
 await contains(page,'Actualizar evaluación validada');
 log('invalid_ai_response_preserves_validated_work');
 if(!electron){
  const client=await page.createCDPSession();
  await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:temp});
  await button(page,'[data-action="report"]');
  const reportPath=path.join(temp,'Evaluacion-articulo.md');
  await timeoutPromise((async()=>{while(!fs.existsSync(reportPath))await delay(100)})(),10000,'Report download');
  const report=fs.readFileSync(reportPath,'utf8');
  assert(report.includes('Estudio independiente de protocolos')&&report.includes('Nota validada:'),'Incomplete report');
  log('report_download');
 }
 await ensureSaved(page);
 assert(await page.$eval('#holdout',e=>e.checked&&e.disabled),'Holdout must remain locked once evaluated');
 log('holdout_control');
 if(electron){
  await button(page,'[data-page="configuracion"]');
  await page.select('#provider','ollama');
  await button(page,'#config-form button');
  await ensureSaved(page);
  await makeText(page,'Prueba Ollama IPC',('Resumen. Verificación operativa de puentes de Electron y procedimientos administrativos. Metodología. Se contrastan enfoques de archivo institucional y se documentan procedimientos. Resultados. Se recopilan hallazgos. Conclusiones. La metodología puede mejorarse. Referencias. Guía 2026. ').repeat(6));
  await button(page,'[data-action="evaluate"]');
  await page.waitForSelector('#validation-form',{timeout:20000});
  await contains(page,'Respuesta local simulada para probar IPC Ollama.');
  log('ollama_local_ipc_mock');
  await value(page,'[name="lesson"]','Evaluación de conectividad local de Ollama sin modelo real.');
  await button(page,'#validation-form button');
  await ensureSaved(page);
 }
 await button(page,'[data-page="estadisticas"]');
 await contains(page,'Comparación por versión validada');
 log('statistics');
 await button(page,'[data-page="configuracion"]');
 await contains(page,'Exportar respaldo');
 log('backup_export_control');
 if(!electron){
  const client=await page.createCDPSession();
  await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:temp});
  await button(page,'[data-action="backup"]');
  const backupPath=path.join(temp,'EntrenarIA-respaldo.json');
  await timeoutPromise((async()=>{while(!fs.existsSync(backupPath))await delay(100);})(),10000,'Backup download');
  const saved=JSON.parse(fs.readFileSync(backupPath,'utf8'));
  assert(saved.articles.length>=6,'Backup incomplete');
  log('backup_download_content',saved.articles.length+' articles');
  const restore=await page.$('#restore');
  await restore.uploadFile(backupPath);
  await page.waitForFunction(()=>document.querySelector('#toast')?.textContent?.includes('restaurado'),{timeout:12000});
  log('backup_restore');
 }

 // Full browser download checked separately; native Electron opens a file dialog.
 await button(page,'[data-page="biblioteca"]');
 const found=await page.$$eval('[data-open]',a=>a.length);
 assert(found>=(electron?7:6),'Imported files lost');
 log('library_persistence',found+' items');
 await page.reload({waitUntil:'networkidle0'});
 await page.waitForSelector('[data-page="biblioteca"]');
 await button(page,'[data-page="biblioteca"]');
 const kept=await page.$$eval('[data-open]',a=>a.length);
 assert(kept>=(electron?7:6),'Data lost on reload');
 log('reload_persistence',kept+' items');
 if(errors.length) console.log('AUDIT_BROWSER_ERRORS '+JSON.stringify(errors));
 if(electron)await browser.disconnect();
 else await browser.close();
 if(child)child.kill();
 console.log('AUDIT_DONE '+(electron?'electron':'web'));
}
main().then(()=>process.exit(0)).catch(e=>{console.error('AUDIT_FAIL',e.stack);process.exit(1)});
