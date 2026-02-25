# 🐾 MIA — Asistente Veterinaria de MundoMascotix

**MIA** (MundoMascotix Intelligent Assistant) es un chatbot profesional de IA integrado en la tienda PrestaShop de MundoMascotix. Actúa como una **asistente farmacéutica veterinaria**: orienta a los clientes antes de comprar (antiparasitarios, nutrición, higiene, suplementos, etc.) con filtros y límites de seguridad (no diagnostica, no prescribe, no dosifica medicamentos con receta).

---

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Funcionalidades implementadas](#funcionalidades-implementadas)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Instalación y puesta en marcha](#instalación-y-puesta-en-marcha)
- [Importación de datos](#importación-de-datos)
- [API — Endpoints](#api--endpoints)
- [Administración (FAQs, prompts, red flags)](#administración-faqs-prompts-red-flags)
- [Integración con PrestaShop](#integración-con-prestashop)
- [Pipeline de conversación](#pipeline-de-conversación)
- [Configuración de variables de entorno](#configuración-de-variables-de-entorno)

---

## Arquitectura

| Capa | Tecnología |
|------|-----------|
| **Frontend** | Vanilla JavaScript · Vite · Tailwind CSS v4 |
| **Backend** | Node.js · Express |
| **Base de datos** | PostgreSQL (full-text search en español, trigram similarity) |
| **IA** | OpenAI GPT-4o vía API |
| **Logging** | Winston (ficheros rotados: error, combined, chat) |

---

## Funcionalidades implementadas

### 1. Chat Hero en la página principal

- El chat aparece como **bloque principal (hero)** al cargar la homepage, no como un widget flotante en una esquina.
- Disclaimer legal visible dentro del bloque.
- Diseño responsive (móvil: bloque optimizado casi a pantalla completa).
- Botones de acceso rápido (antiparasitarios, alimentación, higiene, suplementos).

### 2. Widget flotante en páginas internas

- En páginas de producto, categoría u otras, el chatbot se muestra como un **botón flotante minimizable** en la esquina inferior derecha.
- Al abrirlo despliega un panel de chat completo.
- Si el usuario está en una página de producto, el bot recibe automáticamente el contexto del producto actual.

### 3. Chatbot profesional con IA (OpenAI GPT-4o)

- Respuestas orientadas al e-commerce: guía de compra, comparación de productos, orientación general de uso.
- Tono amable y profesional, siempre en **español de España**.
- Respuestas breves y estructuradas (máx. 6–10 líneas): resumen, recomendación de productos y aviso final si aplica.
- System prompt completo almacenado en base de datos y versionado.

### 4. Detección de Red Flags (emergencias)

- **70+ patrones** de detección divididos en:
  - **Keyword** (coincidencia por subcadena normalizada sin acentos): `no respira`, `convulsiones`, `veneno`, `hemorragia`, `fractura`, `paracetamol`, etc.
  - **Combinados** (todas las keywords deben estar presentes): `vomita` + `sangre`, `no come` + `no bebe` + `aletargado`, etc.
- Categorías: respiración, consciencia, sangrado/shock, envenenamiento, trauma, dolor/abdomen, vulnerables (cachorros/gatitos/senior).
- Niveles de severidad: `emergency`, `urgent`, `caution`.
- Cuando se detecta un red flag, **no se llama a OpenAI**; se devuelve una respuesta fija de emergencia y se solicita el código postal para recomendar una clínica.
- Los patrones se almacenan en la base de datos y se pueden editar vía API de administración.
- Caché en memoria con TTL de 5 minutos para rendimiento.

### 5. Respuestas plantilla por tipo de riesgo

| Tipo | Cuándo se activa |
|------|-----------------|
| `emergency_warning` | Se detecta un red flag (emergencia) |
| `vet_referral` | Síntomas no urgentes que requieren valoración veterinaria |
| `medical_limit` | El usuario pide diagnóstico, dosis, interpretación de síntomas o sustitución de medicamentos |
| `rx_limit` | El usuario pregunta por medicamentos con receta veterinaria |

Todas las plantillas están en español e incluyen la sugerencia de indicar el código postal para recibir una recomendación de clínica colaboradora.

### 6. Integración real con el catálogo de PrestaShop

- Búsqueda full-text en español (`tsvector` con pesos: nombre > categoría/especie > marca/descripción > principios activos).
- Búsqueda por similitud trigram (`pg_trgm`) como fallback.
- Filtros por especie, categoría y precio máximo.
- El bot recomienda productos del catálogo real (no inventa).
- Las respuestas incluyen **tarjetas de producto** con: nombre, precio, enlace "Ver producto" y enlace "Añadir al carrito".
- Si el usuario está en una página de producto, el bot recibe el contexto del producto actual automáticamente.

### 7. Búsqueda de clínicas veterinarias por código postal

- El usuario proporciona un código postal de 5 dígitos (España, 01000–52999).
- Búsqueda exacta por código postal; si no hay resultados, búsqueda por prefijo provincial (2 primeros dígitos).
- Las clínicas se muestran como **tarjetas** con: nombre, dirección, teléfono (con enlace `tel:`), web y badge de urgencias 24h.
- La lista de clínicas se importa desde Excel y se puede actualizar en cualquier momento.

### 8. Procesamiento de vademécums (PDFs)

- Extracción de texto de ficheros PDF mediante `pdf-parse`.
- Fragmentación automática del texto en chunks de ~2000 caracteres (respetando frases).
- Deduplicación por hash SHA-256 (no se reimporta un PDF idéntico).
- Búsqueda por keywords dentro del contenido extraído para enriquecer las respuestas del bot con información técnica/comercial.

### 9. Backend intermedio + seguridad

- La **API key de OpenAI está siempre en el backend**, nunca en el frontend.
- Rate limiting: 30 peticiones/minuto por IP para el chat, 10 peticiones/minuto para endpoints de administración/importación.
- Helmet para cabeceras de seguridad.
- CORS configurado para el dominio del frontend y de la tienda.
- Validación de longitud de mensajes (máx. 2000 caracteres).

### 10. Logging de conversaciones

- Cada conversación se almacena en la tabla `conversations` con un `session_id`, timestamps, conteo de mensajes y flag de emergencia.
- Cada mensaje se almacena en la tabla `messages` con: rol, contenido, tipo de respuesta, red flags detectados, productos recomendados, tokens consumidos y tiempo de procesamiento.
- Winston genera ficheros de log rotados: `error.log`, `combined.log` y `chat.log`.
- Vista SQL `chat_stats` para estadísticas diarias (conversaciones, mensajes, emergencias, derivaciones, tiempos medios).

### 11. Administración de FAQs, prompts y red flags

- **FAQs**: CRUD completo vía API. Cada FAQ tiene categoría, pregunta, respuesta, keywords y prioridad.
- **System prompt**: Versionado. Al actualizar el prompt, se crea una nueva versión y se desactiva la anterior. El bot siempre usa la versión activa más reciente.
- **Red flags**: CRUD completo. Los patrones se pueden añadir, editar, activar/desactivar y eliminar. La caché interna se invalida automáticamente tras cada cambio.
- **Estadísticas**: Endpoint que devuelve stats diarias de los últimos 30 días + totales globales.

### 12. Importación de datos (Excel / CSV / PDF)

- **Productos**: Importación desde Excel/CSV con mapeo flexible de columnas (soporta nombres en español e inglés).
- **Clínicas**: Importación desde Excel con mapeo flexible.
- **Vademécums**: Importación masiva de PDFs desde un directorio (hasta 50 ficheros por petición vía API o ilimitado vía CLI).
- Disponible tanto como **endpoint API** (subida de ficheros con `multer`) como **scripts CLI** para ejecución manual.

---

## Estructura del proyecto

```
mundomascotixIA/
├── backend/
│   ├── env.example                   # Plantilla de variables de entorno
│   ├── package.json
│   ├── data/
│   │   ├── imports/                  # Ficheros Excel/CSV importados
│   │   └── vademecums/              # PDFs de vademécums
│   ├── logs/                         # Ficheros de log (Winston)
│   └── src/
│       ├── index.js                  # Servidor Express (entry point)
│       ├── config/
│       │   ├── index.js              # Carga de .env y exportación de config
│       │   ├── database.js           # Pool de conexiones PostgreSQL
│       │   └── openai.js             # Cliente OpenAI
│       ├── db/
│       │   ├── schema.sql            # Esquema completo de la BBDD
│       │   ├── seed.sql              # Datos iniciales (red flags, prompt, FAQs)
│       │   └── init.js               # Script de inicialización de la BBDD
│       ├── middleware/
│       │   └── errorHandler.js       # Manejador global de errores + 404
│       ├── routes/
│       │   ├── chat.js               # POST /api/chat · GET /api/chat/welcome
│       │   ├── products.js           # Búsqueda de productos
│       │   ├── clinics.js            # Búsqueda de clínicas por CP
│       │   ├── admin.js              # CRUD de FAQs, prompts y red flags
│       │   └── import.js             # Importación de Excel/PDF vía upload
│       ├── services/
│       │   ├── chatService.js        # Orquestador principal del chat
│       │   ├── redFlagService.js     # Detección de emergencias
│       │   ├── templateService.js    # Respuestas plantilla en español
│       │   ├── openaiService.js      # Comunicación con GPT-4o
│       │   ├── productService.js     # Búsqueda full-text de productos
│       │   ├── clinicService.js      # Búsqueda de clínicas por CP
│       │   └── vademecumService.js   # Extracción y búsqueda de PDFs
│       ├── scripts/
│       │   ├── importProducts.js     # CLI: importar catálogo desde Excel
│       │   ├── importClinics.js      # CLI: importar clínicas desde Excel
│       │   └── importVademecums.js   # CLI: importar PDFs de vademécums
│       └── utils/
│           ├── logger.js             # Configuración de Winston
│           └── textNormalizer.js     # Normalización de texto sin acentos
├── frontend/
│   ├── index.html                    # HTML principal
│   ├── package.json
│   ├── vite.config.js                # Vite + proxy al backend + Tailwind
│   └── src/
│       ├── main.js                   # Entry point (detecta hero vs widget)
│       ├── style.css                 # Tailwind CSS v4 + animaciones custom
│       ├── components/
│       │   ├── ChatHero.js           # Chat hero para homepage
│       │   ├── ChatWidget.js         # Widget flotante para páginas internas
│       │   ├── ProductCard.js        # Tarjetas de producto
│       │   └── ClinicCard.js         # Tarjetas de clínica veterinaria
│       ├── services/
│       │   └── api.js                # Cliente HTTP para el backend
│       └── utils/
│           └── helpers.js            # Session ID, escaping, detección PrestaShop
└── prestashop-integration/
    ├── mia-homepage-snippet.tpl      # Snippet para la homepage de PrestaShop
    └── mia-internal-snippet.tpl      # Snippet para páginas internas
```

---

## Requisitos

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14 (con extensiones `uuid-ossp` y `pg_trgm`)
- **API key de OpenAI** con acceso al modelo `gpt-4o`
- **npm** ≥ 9

---

## Instalación y puesta en marcha

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd mundomascotixIA
```

### 2. Configurar variables de entorno

```bash
cd backend
cp env.example .env
```

Edita `backend/.env` con tus credenciales:

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=mundomascotix_chatbot
DB_USER=postgres
DB_PASSWORD=tu_contraseña

OPENAI_API_KEY=sk-tu-api-key
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=800
OPENAI_TEMPERATURE=0.4

FRONTEND_URL=http://localhost:5173
```

### 3. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Inicializar la base de datos

```bash
cd backend
npm run db:init
```

Esto crea la base de datos, las tablas, los triggers de full-text search, los patrones de red flags, el system prompt principal y las FAQs iniciales.

### 5. Importar datos (catálogo, clínicas, vademécums)

```bash
# Productos desde Excel
npm run import:products -- ruta/al/catalogo.xlsx

# Clínicas desde Excel
npm run import:clinics -- ruta/al/clinicas.xlsx

# Vademécums desde una carpeta de PDFs
npm run import:vademecums -- ruta/a/carpeta-pdfs/
```

### 6. Arrancar los servidores de desarrollo

```bash
# Terminal 1 — Backend (puerto 3001)
cd backend
npm run dev

# Terminal 2 — Frontend (puerto 5173)
cd frontend
npm run dev
```

### 7. Abrir en el navegador

```
http://localhost:5173
```

El chat hero de MIA aparecerá como bloque principal.

---

## Importación de datos

### Productos (Excel/CSV)

El fichero Excel debe tener las columnas del catálogo. El sistema acepta los nombres de columna tanto en español como en inglés:

| Español | Inglés | Descripción |
|---------|--------|-------------|
| `nombre` / `Nombre` | `name` / `Name` | Nombre del producto (**obligatorio**) |
| `codigo` / `Código` | `code` / `Code` | Código interno / SKU |
| `marca` / `Marca` | `brand` / `Brand` | Marca |
| `categoria` / `Categoría` | `category` / `Category` | Categoría principal |
| `subcategoria` / `Subcategoría` | `subcategory` | Subcategoría |
| `especie` / `Especie` | `species` / `Species` | Especie (perro, gato, etc.) |
| `precio` / `Precio` | `price` / `Price` | Precio en EUR |
| `url` / `URL` | `product_url` | URL de la página de producto |
| `carrito` | `add_to_cart_url` / `cart_url` | URL para añadir al carrito |
| `imagen` / `Imagen` | `image_url` | URL de la imagen |
| `descripcion` / `Descripción` | `description` | Descripción |
| `indicaciones` / `Indicaciones` | `indications` | Indicaciones de uso |
| `principio_activo` | `active_ingredients` | Principios activos |
| `receta` / `Receta` | `requires_prescription` | ¿Requiere receta? (true/false) |

### Clínicas veterinarias (Excel)

| Español | Inglés | Descripción |
|---------|--------|-------------|
| `nombre` / `Nombre` | `name` / `Name` | Nombre de la clínica (**obligatorio**) |
| `direccion` / `Dirección` | `address` | Dirección |
| `ciudad` / `Ciudad` | `city` | Ciudad |
| `provincia` / `Provincia` | `province` | Provincia |
| `codigo_postal` / `CP` | `postal_code` | Código postal (**obligatorio**) |
| `telefono` / `Teléfono` | `phone` | Teléfono |
| `Email` / `correo` | `email` | Email |
| `web` / `Web` | `website` | Página web |
| `urgencias` / `Urgencias` | `is_emergency` | ¿Servicio de urgencias? (true/false) |
| `notas` / `Notas` | `notes` | Notas adicionales |

### Vademécums (PDFs)

Coloca los ficheros PDF en una carpeta y ejecuta el script de importación. El sistema:
- Extrae el texto de cada PDF.
- Lo fragmenta en chunks de ~2000 caracteres.
- Lo almacena en la base de datos para búsqueda.
- Detecta duplicados por hash SHA-256.

---

## API — Endpoints

### Chat

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/chat` | Enviar un mensaje al chatbot |
| `GET` | `/api/chat/welcome` | Obtener el mensaje de bienvenida |
| `GET` | `/api/chat/health` | Health check del servicio |

**POST /api/chat** — Body:

```json
{
  "sessionId": "sess_abc123",
  "message": "¿Qué antiparasitario me recomiendas para mi perro de 10 kg?",
  "conversationId": null,
  "productContext": null
}
```

**Respuesta:**

```json
{
  "success": true,
  "data": {
    "conversationId": "uuid-de-la-conversacion",
    "message": "Texto de respuesta de MIA...",
    "responseType": "normal",
    "products": [
      {
        "id": 1,
        "name": "Nombre del producto",
        "price": 12.50,
        "productUrl": "https://...",
        "addToCartUrl": "https://..."
      }
    ],
    "clinics": [],
    "tokensUsed": 245,
    "processingTimeMs": 1200
  }
}
```

### Productos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/products/search?q=...&species=...&category=...&limit=...` | Buscar productos |
| `GET` | `/api/products/:id` | Obtener producto por ID |
| `GET` | `/api/products/category/:category` | Obtener productos por categoría |
| `GET` | `/api/products/stats/count` | Contar productos activos |

### Clínicas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/clinics/:postalCode` | Buscar clínicas por código postal |
| `GET` | `/api/clinics/stats/count` | Contar clínicas activas |

### Importación de datos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/import/products` | Importar productos desde Excel (multipart file) |
| `POST` | `/api/import/clinics` | Importar clínicas desde Excel (multipart file) |
| `POST` | `/api/import/vademecums` | Importar PDFs de vademécums (multipart files) |

---

## Administración (FAQs, prompts, red flags)

### FAQs

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/faqs` | Listar todas las FAQs |
| `POST` | `/api/admin/faqs` | Crear una FAQ |
| `PUT` | `/api/admin/faqs/:id` | Editar una FAQ |
| `DELETE` | `/api/admin/faqs/:id` | Eliminar una FAQ |

**POST /api/admin/faqs** — Body:

```json
{
  "category": "alimentacion",
  "question": "¿Qué alimentación es mejor para un cachorro?",
  "answer": "Para cachorros se recomienda...",
  "keywords": ["cachorro", "alimentacion", "comida"],
  "priority": 8
}
```

### System Prompts

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/prompts` | Listar todos los prompts (con versiones) |
| `PUT` | `/api/admin/prompts/:name` | Actualizar un prompt (crea nueva versión) |

Al actualizar, la versión anterior se desactiva y se crea una nueva versión activa. El bot siempre usa la versión activa más reciente del prompt `main_assistant`.

### Red Flags

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/red-flags` | Listar todos los patrones |
| `POST` | `/api/admin/red-flags` | Añadir un patrón nuevo |
| `PUT` | `/api/admin/red-flags/:id` | Editar un patrón |
| `DELETE` | `/api/admin/red-flags/:id` | Eliminar un patrón |

**POST /api/admin/red-flags** — Body:

```json
{
  "category": "envenenamiento",
  "pattern_type": "keyword",
  "keywords": ["ibuprofeno"],
  "severity": "emergency"
}
```

Para reglas combinadas (todas las keywords deben estar presentes):

```json
{
  "category": "combinado",
  "pattern_type": "combined",
  "keywords": ["no come", "temblores"],
  "severity": "emergency"
}
```

### Estadísticas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Estadísticas diarias + totales |

Devuelve: conversaciones totales, mensajes, emergencias, derivaciones, límites médicos, tiempos medios de respuesta.

---

## Integración con PrestaShop

En la carpeta `prestashop-integration/` se incluyen dos snippets de Smarty para integrar el chatbot en el tema de PrestaShop:

### Homepage (Hero)

Archivo: `mia-homepage-snippet.tpl`

Colocar en la plantilla de la homepage del tema (`themes/your-theme/templates/index.tpl`) como primer bloque visible:

```smarty
<div id="mia-chat-hero"></div>
<script type="module" src="http://TU_VPS:5173/src/main.js"></script>
```

### Páginas internas (Widget flotante)

Archivo: `mia-internal-snippet.tpl`

Colocar en el footer del layout general del tema, excluyendo la homepage:

```smarty
{if $page.page_name != 'index'}
  <script type="module" src="http://TU_VPS:5173/src/main.js"></script>
{/if}
```

En **producción** (tras `npm run build` en el frontend), apuntar a los ficheros compilados en `dist/`.

---

## Pipeline de conversación

```
Mensaje del usuario
  │
  ├─ 1. ¿Contiene un código postal? → Búsqueda de clínicas → Respuesta con tarjetas
  │
  ├─ 2. Detección de Red Flags (keyword + combined, sin acentos)
  │     ├─ SI → Respuesta de emergencia (plantilla fija, NO llama a OpenAI)
  │     │       + Log de emergency_warning
  │     │       + Solicitud de código postal
  │     └─ NO → Continuar
  │
  ├─ 3. ¿Pide diagnóstico/dosis/receta?
  │     ├─ SI → Respuesta medical_limit o rx_limit (plantilla fija)
  │     └─ NO → Continuar
  │
  ├─ 4. Búsqueda de productos relevantes en el catálogo (full-text español)
  │
  ├─ 5. Búsqueda de información técnica en vademécums
  │
  ├─ 6. Llamada a OpenAI GPT-4o con:
  │     • System prompt (desde BBDD)
  │     • Historial de conversación (últimos 10 mensajes)
  │     • Contexto del producto actual (si está en página de producto)
  │     • Productos relevantes del catálogo
  │     • Información técnica de vademécums
  │
  ├─ 7. Guardado en base de datos (conversación + mensaje + métricas)
  │
  └─ 8. Respuesta al frontend con: mensaje + tarjetas de producto + tarjetas de clínica
```

---

## Configuración de variables de entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor backend | `3001` |
| `NODE_ENV` | Entorno (`development` / `production`) | `development` |
| `DB_HOST` | Host de PostgreSQL | `localhost` |
| `DB_PORT` | Puerto de PostgreSQL | `5432` |
| `DB_NAME` | Nombre de la base de datos | `mundomascotix_chatbot` |
| `DB_USER` | Usuario de PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña de PostgreSQL | — |
| `OPENAI_API_KEY` | API key de OpenAI | — |
| `OPENAI_MODEL` | Modelo a usar | `gpt-4o` |
| `OPENAI_MAX_TOKENS` | Máximo de tokens por respuesta | `800` |
| `OPENAI_TEMPERATURE` | Temperatura (creatividad) | `0.4` |
| `FRONTEND_URL` | URL del frontend (para CORS) | `http://localhost:5173` |
| `PRESTASHOP_URL` | URL de la tienda PrestaShop | — |
| `PRESTASHOP_API_KEY` | API key de PrestaShop (opcional) | — |

---

## Licencia

Proyecto privado — MundoMascotix © 2026
