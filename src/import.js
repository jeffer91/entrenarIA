import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth/mammoth.browser.js';
pdfjs.GlobalWorkerOptions.workerSrc=worker;
export async function extract(file){
 if(file.size>25*1024*1024)throw new Error('El archivo supera 25 MB.');
 const buffer=await file.arrayBuffer();let text='',warnings=[];
 const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='pdf'){
 const task=pdfjs.getDocument({data:new Uint8Array(buffer.slice(0)),isEvalSupported:false});
 const pdf=await task.promise;
 try{if(pdf.numPages>150)throw new Error('Máximo 150 páginas por artículo.');
 for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);const content=await p.getTextContent();const body=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');text+=`\n[Página ${i}]\n${body}`;if(body.trim().length<40)warnings.push(`Página ${i}: poco texto extraíble; podría necesitar OCR.`);}}finally{await task.destroy();}
 }else if(ext==='docx'){const r=await mammoth.extractRawText({arrayBuffer:buffer});text=r.value;warnings.push(...r.messages.map(m=>m.message));}
 else if(ext==='txt')text=new TextDecoder().decode(buffer);
 else throw new Error('Selecciona PDF, DOCX o TXT.');
 if(text.trim().length<150)throw new Error('No hay suficiente texto extraíble. Si es un escaneo, aplica OCR y vuelve a cargarlo.');
 if(text.length>120000)throw new Error('El texto supera 120.000 caracteres. Divide el documento para evitar una evaluación truncada.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(b=>b.toString(16).padStart(2,'0')).join('');
 return {text,hash,warnings};
}
