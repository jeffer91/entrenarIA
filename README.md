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
3. Ajustar la rúbrica inicial orientativa a las reglas institucionales.
4. Evaluar con IA. Cada criterio devuelve nota o «no evaluable», observación, evidencia literal y sugerencia. Se comprueba si la evidencia citada está en el texto, no si los datos son auténticos.
5. Corregir las notas y observaciones, escribir una lección y confirmar. Solo entonces se usa como memoria.
6. Reservar casos de prueba ANTES de usarlos como ejemplos. Se excluyen ellos mismos y archivos idénticos en la recuperación. Para una prueba rigurosa, no cargar otras versiones del mismo estudio como entrenamiento.
7. Repetir evaluaciones conservando historial y exportar resultados Markdown o respaldos JSON.

## Qué significa aprender

Recuperación por coincidencia léxica y carrera de hasta cuatro ejemplos humanos validados compatibles con la rúbrica. Los ejemplos se incorporan al contexto; no se modifican los pesos del modelo ni se promete mejora automática. Las estadísticas comparan la última nota IA con la nota humana (error absoluto medio), separando casos reservados. El historial permite revisar versiones, pero no se ejecuta automáticamente un benchmark longitudinal.

## Datos y límites

IndexedDB guarda textos extraídos, notas, rúbricas e historial en el perfil de Electron (userData) o en el navegador. Los archivos originales NO se conservan: mantenlos aparte. No se suben artículos al repositorio ni se publican en Pages. Web y escritorio son almacenes separados; usa exportar/importar respaldo para trasladar datos. Borrar los datos del navegador o el perfil elimina ese almacenamiento; haz respaldos regulares. El respaldo no contiene claves.

Las instrucciones incrustadas en artículos se tratan como datos no confiables. La evaluación no verifica por sí sola la existencia de referencias, plagio, autoría por IA ni datos de campo. La validación humana sigue siendo necesaria. La app no incluye una rúbrica institucional oficial ni artículos de estudiantes preinstalados.

## Arquitectura

- `electron/`: ventana aislada, sandbox y puente limitado a Ollama.
- `src/app.js`, `style.css`: interfaz compartida sin código remoto.
- `src/import.js`: lectura PDF/DOCX local con dependencias empaquetadas.
- `src/core.js`: rúbrica, puntuación, validación y selección de memoria.
- `src/ai.js`: proveedor de IA y validación de resultados.
- `src/storage.js`: persistencia IndexedDB.
- `tests/`: reglas de notas, evidencia, exclusiones y respaldos.
