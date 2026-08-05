# Onboarding — Setup local

Guia para levantar el proyecto desde cero.

## Stack y producto

- **Stack:** [`AGENTS.md` §2](../AGENTS.md#2-stack-del-proyecto)
- **Producto / dominio:** [`AGENTS.md` §3](../AGENTS.md#3-contexto-de-negocio)
- **Capas / carpetas:** [`docs/architecture.md`](./architecture.md)

---

## Requisitos previos

- [ ] Python 3.12+ (con pip)
- [ ] Node.js 20+ (con npm)
- [ ] Git
- [ ] Docker (opcional, para despliegue)
- [ ] Revit 2023+ con Speckle Connector y pyRevit instalados (para el push en tiempo real)
- [ ] Cuenta en Speckle (gratuita) y token de acceso personal
- [ ] Cuenta en OpenRouter (opcional, para IA) y API key

---

## 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
cd data-speckle
```

---

## 2. Variables de entorno

```bash
cp .env.example .env
```

Abre `.env` y completa los valores. Variables obligatorias:

- `SPECKLE_TOKEN` — token de acceso personal de Speckle
- `SPECKLE_STREAM_ID` — ID del stream de donde leer datos
- `JWT_SECRET` — clave secreta para firmar tokens JWT
- `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` — credenciales del unico usuario

---

## 3. Instalar dependencias

### Backend (Python)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend (Node)

```bash
cd apps/web
npm install
```

---

## 4. Base de datos

El backend usa SQLite (sin servidor externo). Las tablas se crean automaticamente al iniciar.

Para crear la DB manualmente:

```bash
cd apps/api
python -m alembic upgrade head
```

---

## 5. Levantar el servidor de desarrollo

### Backend

```bash
cd apps/api
source .venv/bin/activate
uvicorn src.api.main:app --reload --port 8000
```

### Frontend

```bash
cd apps/web
npm run dev
```

- API disponible en `http://localhost:8000` (docs en `http://localhost:8000/docs`)
- Dashboard disponible en `http://localhost:5173`

---

## 6. Verificar que todo funciona

- [ ] API: `GET http://localhost:8000/health` responde `{"status": "ok"}`
- [ ] Login: `POST http://localhost:8000/api/auth/token` con email/password devuelve JWT
- [ ] Frontend: la pagina de login carga en `http://localhost:5173`
- [ ] El agente de Cursor responde en espanol (ver `core.mdc`)

---

## 7. Configurar pyRevit (opcional, para tiempo real)

1. Instalar pyRevit desde https://github.com/eirannejad/pyRevit
2. Copiar el script de `apps/api/scripts/revit_push.py` a la carpeta de scripts de pyRevit
3. Configurar `API_WS_URL` en el script apuntando a `ws://localhost:8000/ws/revit`
4. En Revit, ejecutar el script. Los cambios de elementos se enviaran automaticamente.

---

## Solucion de problemas frecuentes

| Sintoma | Causa probable | Solucion |
|---------|---------------|---------|
| `ModuleNotFoundError: No module named 'speckle'` | Dependencias no instaladas | `pip install -r requirements.txt` |
| `Connection refused` en WebSocket | API no levantada | Verificar `uvicorn` corriendo en :8000 |
| Error de autenticacion Speckle | Token invalido o caducado | Regenerar token en https://speckle.xyz/profile |
| `npm run dev` falla | Node version antigua | Usar Node 20+ (`node -v`) |
| Puerto ocupado | Otro proceso usa :8000 o :5173 | Cambiar en `.env` o matar el proceso |

---

## Contexto adicional

| Tema | Fuente |
|------|--------|
| Stack / producto | [`AGENTS.md`](../AGENTS.md) |
| Capas / carpetas / flujos | [`architecture.md`](./architecture.md) |
| Decisiones (ADRs) | [`decisions.md`](./decisions.md) |
| Prompts paso a paso | [`prompts/`](./prompts/) |