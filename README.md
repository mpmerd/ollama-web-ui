# Ollama Web UI 🤖

Interfaz web moderna tipo ChatGPT para interactuar con modelos de lenguaje
locales **Ollama**, con **gestión inteligente de memoria**: los modelos solo
se cargan bajo demanda y se descargan automáticamente tras inactividad.

## 🎯 Filosofía

**Mínima huella de recursos.** Cuando no hay conversaciones activas, el backend
consume ~30-50 MB de RAM y 0% CPU. Los modelos de Ollama SOLO están en memoria
mientras alguien conversa con ellos. Tras el timeout configurable (default 15 min),
se descargan automáticamente.

## ✨ Características

- **Listado completo** de modelos disponibles en Ollama (nombre, tamaño, params, cuantización)
- **Selector de modelo** con badge de estado: 🟢 Loaded / ⚫ Unloaded
- **Chat en tiempo real** con streaming (SSE), markdown, y resaltado de sintaxis
- **Auto-unload**: el modelo se descarga de VRAM/RAM tras inactividad
- **Carga perezosa (lazy loading)**: el modelo se carga solo al enviar el primer mensaje
- **Cambio inteligente de modelo**: al seleccionar otro modelo, descarga el anterior si no tiene conversaciones activas para liberar RAM inmediatamente
- **Límite de modelos simultáneos** configurable (1-3, default 2): protege RAM en entornos multi-usuario
- **Soporte para modelos "thinking"** (Gemma4, DeepSeek R1): muestra 🧠 cadena de razonamiento interna antes de la respuesta
- **Subida de archivos**: 📎 txt, md, csv, py, json, html, log, pdf — contenido inyectado en el prompt para resúmenes
- **Soporte de imágenes**: 🖼️ solo habilitado si el modelo lo soporta (gemma4, qwen25, llava)
- **Monitor de recursos**: RAM con barra de uso + alertas visuales (+ VRAM GPU NVIDIA)
- **Forzar unload** manual desde la UI
- **Múltiples conversaciones** con diferentes modelos simultáneamente
- **Modo oscuro** por defecto (diseñado para sesiones largas)
- **Historial persistente** en SQLite
- **Exportar/Importar** conversaciones en JSON
- **Configuración**: temperatura, max tokens, system prompt, timeout, límite de modelos, alerta de RAM
- **Autenticación opcional** por token Bearer
- **Docker Compose** listo para usar
- Accesible desde **cualquier dispositivo en la red local**

## 🧠 Model Manager: Lógica de recursos

### Ciclo de vida de un modelo

```
IDLE → Usuario crea chat → Contador de conversaciones++
    → Usuario envía primer mensaje → Lazy load del modelo en Ollama
    → Chat activo → timestamp de actividad renovado en cada mensaje
    → Usuario cierra/deleta conversación → Contador de conversaciones--
    → 15 min sin actividad → keep_alive: 0s → Modelo descargado de RAM
```

### Cambio de modelo (model switching)

Al enviar un mensaje con un modelo diferente al cargado:
- Si el modelo anterior **tiene conversaciones activas** → se mantiene cargado
- Si el modelo anterior **NO tiene conversaciones activas** → se descarga inmediatamente para liberar RAM
- Si todos los slots están ocupados con conversaciones activas → HTTP 429 + mensaje

### Límite de modelos simultáneos

| Setting | Default | Rango |
|---------|---------|-------|
| `max_loaded_models` | 2 | 1-3 |
| `ram_warning_percent` | 90% | 50-99% |

Controla cuántos modelos pueden coexistir en RAM simultáneamente. Cuando se alcanza el límite:
- El modelo **más antiguo sin conversaciones activas** se descarga para liberar un slot.
- Si **todos** tienen conversaciones activas → el nuevo modelo es **rechazado** (HTTP 429) con mensaje explicativo.

### Advertencia de RAM

En la sidebar se muestra una barra de uso de RAM:
- 🟦 Normal (≤80%)
- 🟨 Advertencia (≥90%): "⚠️ High RAM usage. Close idle conversations."
- 🟥 Crítico (≥95%)

## 📦 Estructura del proyecto

```
ollama-web-ui/
├── docker-compose.yml          # Orquestación Docker
├── .env.example                # Variables de entorno
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py             # Punto de entrada FastAPI
│       ├── config.py           # Config desde env vars
│       ├── database.py         # SQLite + aiosqlite
│       ├── schemas.py          # Pydantic models
│       ├── routers/
│       │   ├── models.py       # CRUD de modelos + detección de imágenes
│       │   ├── chat.py         # Chat SSE + upload archivos + límite de modelos
│       │   ├── conversations.py # Conversaciones + export/import
│       │   └── system.py       # Health, RAM, GPU, settings
│       └── services/
│           ├── ollama_client.py # Cliente asíncrono para Ollama API + thinking
│           └── model_manager.py # Gestor de ciclo de vida de modelos (sin deadlocks)
└── frontend/
    ├── Dockerfile
    ├── nginx.conf              # proxy_read_timeout 300s para modelos grandes
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── api/index.js         # Cliente API REST + upload
        ├── store/useStore.js    # Zustand store + files + thinking
        └── components/
            ├── Layout.jsx
            ├── Sidebar.jsx
            ├── ChatView.jsx     # Thinking indicator + file previews
            ├── ChatInput.jsx    # 📎 File + 🖼️ Image upload buttons
            ├── MessageBubble.jsx
            ├── ModelSelector.jsx
            ├── ConversationList.jsx
            ├── SettingsPanel.jsx # Max loaded models slider
            ├── ResourceMonitor.jsx # RAM bar + slots + alerts
            └── ErrorToast.jsx
```

## 🚀 Instalación y ejecución

### Requisitos

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/install/)
- **Ollama** instalado y corriendo en el host
  - [Instalar Ollama](https://ollama.com/download)
  - Tener al menos un modelo descargado: `ollama pull llama3.2`

### Docker Compose (recomendado)

```bash
cd ollama-web-ui
cp .env.example .env
docker compose up -d --build
```

La app estará disponible en **http://localhost:8080**.

### Desarrollo local

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend
cd frontend
npm install && npm run dev
```

### ⚙️ Variables de entorno (`.env`)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://host.docker.internal:11434` | URL de Ollama |
| `MODEL_TIMEOUT_MINUTES` | `15` | Minutos de inactividad → auto-unload |
| `OLLAMA_KEEP_ALIVE` | `10m` | Tiempo que Ollama mantiene el modelo en uso activo |
| `MAX_LOADED_MODELS` | `2` | Máx modelos cargados simultáneamente (1-3) |
| `RAM_WARNING_PERCENT` | `90` | Umbral de alerta visual de RAM |
| `AUTH_TOKEN` | `` (vacío) | Token Bearer opcional |

## 📡 API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/models` | Listar modelos con soporte de imágenes |
| `GET` | `/api/models/loaded` | Modelos cargados (Ollama PS) |
| `POST` | `/api/models/load` | Cargar un modelo (descarga otros si se necesita) |
| `POST` | `/api/models/unload` | Descargar un modelo |
| `GET` | `/api/models/status` | Estado de todos los modelos trackeados |
| `POST` | `/api/chat/send` | Enviar mensaje (SSE: token, thinking, status, done) |
| `POST` | `/api/chat/upload` | Subir archivo (texto/image → base64) |
| `POST` | `/api/chat/title` | Renombrar conversación |
| `GET` | `/api/conversations` | Listar conversaciones |
| `GET` | `/api/conversations/:id` | Obtener conversación |
| `POST` | `/api/conversations` | Crear conversación |
| `DELETE` | `/api/conversations/:id` | Eliminar conversación |
| `GET` | `/api/conversations/:id/export` | Exportar a JSON |
| `POST` | `/api/conversations/import` | Importar desde JSON |
| `GET` | `/api/system/health` | Health check |
| `GET` | `/api/system/ram` | RAM: total, available, percent, warning, critical |
| `GET` | `/api/system/stats` | Full stats (RAM + GPU + modelos + límites) |
| `GET` | `/api/system/settings` | Configuración actual |
| `POST` | `/api/system/settings` | Actualizar timeout, max_models, etc |

### Eventos SSE del chat

| type | Descripción |
|------|-------------|
| `start` | Inicio del stream (message_id, conversation_id) |
| `status` | ⏳/✅ Carga del modelo |
| `thinking` | 🧠 Cadena de razonamiento (Gemma4, DeepSeek) |
| `token` | Texto de la respuesta |
| `title` | Título generado automáticamente |
| `done` | Fin del stream |
| `error` | Error |

## 🛠️ Bugs conocidos y soluciones

### "Cannot reach Ollama"
- Verifica que Ollama está corriendo: `ollama serve`
- En Docker, OLLAMA_HOST usa `host.docker.internal` (Linux con `extra_hosts`)

### "Failed to load model" / request se queda colgada
- La primera carga de un modelo grande (gemma4: 5GB) puede tomar 1-2 minutos
- Nginx tiene `proxy_read_timeout` de 300s para cubrir este caso
- La UI muestra "⏳ Loading model into memory..." durante la carga

### Gemma4 muestra "pensando" sin respuesta
- Gemma4 es un modelo "thinking" — su razonamiento aparece en 🧠 itálico gris
- La respuesta final aparece automáticamente cuando termina de razonar

### "All model slots are in use" (HTTP 429)
- El límite de modelos se alcanzó y todos tienen conversaciones activas
- Cierra conversaciones inactivas o aumenta el límite en Settings

## 📄 Licencia

MIT
