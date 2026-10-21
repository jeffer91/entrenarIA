# EntrenarIA

Aplicación de escritorio Electron y web GitHub Pages para evaluar artículos académicos con una rúbrica editable y memoria de correcciones humanas.

## Iniciar escritorio

Instala Node.js 24 LTS (mínimo 22.12). Desde la carpeta del proyecto:

```sh
npm install
npm start
```

`npm start` compila la interfaz y abre Electron. No requiere servidor web ni Python. La primera instalación descarga Electron y necesita internet. Linux requiere las bibliotecas de escritorio habituales de Electron; ejecutar como usuario normal, no root.

## Web

https://jeffer91.github.io/entrenarIA/

El workflow `.github/workflows/pages.yml` ejecuta pruebas, compila y publica al actualizar main. En Settings > Pages debe estar seleccionado GitHub Actions. Todas las rutas de recursos son relativas para soportar `/entrenarIA/` y Electron.

Desarrollo local: `npm run dev`. Compilación: `npm run build`. Pruebas: `npm test`.

## Configurar la IA

- **Gemini (web y escritorio):** introduce tu clave de API y un identificador de modelo disponible en tu cuenta en Configuración. La clave solo vive en memoria hasta cerrar o recargar. El nombre sugerido es editable. Cada evaluación requiere confirmar el envío del texto, la rúbrica y hasta cuatro ejemplos validados al proveedor; puede consumir cuota o tener costo. No hay claves incrustadas ni un proxy público con credenciales compartidas.
- **Ollama (Electron):** instala Ollama, descarga un modelo capaz de seguir instrucciones y devolver JSON (por ejemplo `ollama pull qwen3:8b`), deja el servicio activo y configura el nombre exacto. El hardware determina velocidad y capacidad. El puente de Electron solo llama al endpoint local fijo `127.0.0.1:11434/api/generate`. No requiere claves ni CORS en el navegador.
- Sin configurar un motor se puede importar, organizar y hacer comprobaciones estructurales. Estas no asignan una nota ni se presentan como IA.

## Flujo

1. Importar PDF, DOCX o TXT (25 MB, 150 páginas PDF y 120.000 caracteres como máximos).
2. Comprobar el texto extraído y la carrera. Los PDF escaneados necesitan OCR externo; no se interpreta visualmente cada figura. Las ecuaciones y tablas complejas deben verificarse manualmente.
3. Ajustar la rúbrica inicial orientativa o crear perfiles específicos en **Rúbricas académicas por carrera**. Cada carrera sin perfil propio utiliza la rúbrica general. No son rúbricas oficiales preinstaladas.
4. Evaluar con IA. Por defecto el sistema ejecuta **dos solicitudes** al modelo: evaluación inicial y segunda revisión crítica. Puedes desactivar la segunda en Configuración para ahorrar consumo. Cada criterio devuelve nota o «no evaluable», observación, evidencia literal y sugerencia. La coincidencia de la cita se verifica contra el texto extraído (ignorando mayúsculas y acentos), pero no certifica autenticidad ni pertinencia.
5. Corregir notas y observaciones, marcar «No evaluable» si procede, escribir una lección y confirmar. Solo las correcciones humanas aprobadas se usan como memoria; las validaciones anteriores siguen disponibles cuando se reevaluó el documento.
6. Reservar casos de prueba **antes de la primera evaluación** (la selección queda bloqueada una vez evaluado). Se excluyen el artículo actual, archivos idénticos y versiones muy semejantes detectadas por similitud del texto/título. Esta detección es aproximada: para una prueba rigurosa, no introducir otras versiones del mismo estudio como entrenamiento.
7. Repetir evaluaciones conservando historial; exportar Markdown y usar **Imprimir / PDF** (PDF nativo en Electron; diálogo de impresión/guardar PDF en navegadores compatibles). Exportar/restaurar respaldos JSON.

## Qué significa aprender

Recuperación por coincidencia léxica del contenido, título, lección y carrera de hasta cuatro ejemplos humanos validados compatibles con la rúbrica. Se exige una relevancia mínima y los cambios cosméticos en el nombre de un criterio no anulan su memoria. Se intenta evitar que diferentes revisiones del mismo artículo contaminen la evaluación. La ficha muestra qué ejemplos se utilizaron. Los ejemplos se incorporan al contexto; no se modifican los pesos del modelo ni se promete mejora automática. Las estadísticas incluyen evaluaciones históricas, diferencias por criterio y casos reservados. La comparación **no constituye un benchmark longitudinal controlado**: el modelo, la rúbrica y los artículos pueden cambiar entre evaluaciones.

## Datos y límites

IndexedDB guarda textos extraídos, notas, rúbricas por carrera e historial en el perfil de Electron (userData) o en el navegador. Los archivos originales NO se conservan: mantenlos aparte. No se suben artículos al repositorio ni se publican en Pages. Web y escritorio son almacenes separados; usa exportar/importar respaldo para trasladar datos. Borrar los datos del navegador o el perfil elimina ese almacenamiento; haz respaldos regulares. El respaldo no contiene claves.

Las instrucciones incrustadas en artículos se tratan como datos no confiables. La evaluación no verifica por sí sola la existencia de referencias, plagio, autoría por IA ni datos de campo. La validación humana sigue siendo necesaria. La app no incluye una rúbrica institucional oficial ni artículos de estudiantes preinstalados.

## Arquitectura

- `electron/`: ventana aislada, sandbox y puente limitado a Ollama.
- `src/app.js`, `style.css`: interfaz compartida sin código remoto.
- `src/import.js`: lectura PDF/DOCX local con dependencias empaquetadas.
- `src/core.js`: rúbrica, puntuación, validación y selección de memoria.
- `src/ai.js`: proveedores Gemini/Ollama, revisión independiente opcional y validación de resultados.
- `src/report.js`: informe académico HTML imprimible en PDF con evidencias y notas humanas.
- `tests/diagnostic-ui.cjs`: pruebas reales de interfaces web y Electron con respuestas de IA simuladas.
- `tests/quality.test.js`: pruebas de regresión sobre memoria, respaldos, calificaciones e informes.
- `src/storage.js`: persistencia IndexedDB.
- `tests/`: reglas de notas, evidencia, exclusiones y respaldos.

## Pruebas y criterios de aceptación

- `npm test`: reglas puras, notas, citas, memoria, historial, integridad de respaldo y estructura del informe.
- Workflow `audit-ui.yml`: abre Chrome y Electron con `npm start` en Linux virtualizado, importa PDF/DOCX/TXT, guarda rúbricas, evalúa con servicios simulados, valida, comprueba memoria y estadísticas, descarga/restaura datos. No es una prueba de calidad de un modelo real ni sustituye pruebas manuales en Windows/macOS.
- Para uso académico oficial **falta** contrastar artículos reales con evaluaciones humanas validadas, verificar lecturas de tablas/figuras y probar claves/modelos reales. La IA no debe asignar notas oficiales sin una revisión responsable.
- `npm audit` informa tres alertas moderadas de la cadena `mammoth` → `argparse` → `sprintf-js` (GHSA-hp3w-g68c-fv3c). La cadena corresponde a la herramienta CLI de Mammoth, no a su lector browser utilizado aquí, pero la alerta sigue abierta y requiere vigilancia. No fuerces una degradación a una versión antigua como supuesto arreglo.
