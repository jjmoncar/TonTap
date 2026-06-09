# 📋 TonTap — Especificación Técnica

## Índice

1. [Descripción General](#1-descripción-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Módulos y Funcionalidades](#4-módulos-y-funcionalidades)
   - 4.1 [Autenticación y Registro](#41-autenticación-y-registro)
   - 4.2 [Dashboard del Usuario](#42-dashboard-del-usuario)
   - 4.3 [Sistema de Tareas (Direct Links)](#43-sistema-de-tareas-direct-links)
   - 4.4 [Contador de 30 Segundos y Validación Backend](#44-contador-de-30-segundos-y-validación-backend)
   - 4.5 [Sistema CAPTCHA](#45-sistema-captcha)
   - 4.6 [Sistema de Puntos](#46-sistema-de-puntos)
   - 4.7 [Sistema de Retiros en TON](#47-sistema-de-retiros-en-ton)
   - 4.8 [Historial de Actividad](#48-historial-de-actividad)
   - 4.9 [Panel de Administración](#49-panel-de-administración)
   - 4.10 [Sistema Anti-Fraude](#410-sistema-anti-fraude)
5. [Modelo de Base de Datos](#5-modelo-de-base-de-datos)
6. [API Endpoints](#6-api-endpoints)
7. [Flujo Completo del Usuario](#7-flujo-completo-del-usuario)
8. [Reglas de Negocio](#8-reglas-de-negocio)
9. [Seguridad](#9-seguridad)
10. [Estructura de Carpetas del Proyecto](#10-estructura-de-carpetas-del-proyecto)
11. [Variables de Entorno](#11-variables-de-entorno)
12. [Consideraciones de Despliegue](#12-consideraciones-de-despliegue)

---

## 1. Descripción General

**TonTap** es una plataforma web en la que los usuarios se registran, completan tareas publicitarias (hacer clic en enlaces de Adsterra y permanecer en ellos al menos **30 segundos**), resuelven un CAPTCHA para validar la tarea, y acumulan **puntos** que pueden canjear por **Toncoin (TON)**. El objetivo es monetizar el tráfico publicitario recompensando a los usuarios de forma justa y verificada.

### Características clave

- Hasta **15–20 tareas diarias** por usuario (equivalente al número de direct links activos).
- Validación del tiempo de exposición tanto en **frontend** como en **backend**.
- CAPTCHA obligatorio al finalizar cada tarea.
- Retiro manual de puntos convertidos a **TON** hacia la billetera del usuario.
- Panel de administración completo.
- Sistema anti-fraude multicapa.

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Base de datos** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth (email/contraseña + Google OAuth) |
| **ORM / Queries** | Supabase JS Client v2 |
| **Estilos** | Tailwind CSS |
| **Componentes UI** | shadcn/ui |
| **CAPTCHA** | Google reCAPTCHA v2 (`react-google-recaptcha`) |
| **Blockchain TON** | TON Connect SDK / TON API (Toncenter) |
| **Estado global** | Zustand o Context API |
| **Despliegue** | Vercel (frontend + API routes) |
| **Almacenamiento** | Supabase Storage (avatares, comprobantes) |

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                     │
│  Next.js App Router · Tailwind · shadcn/ui · reCAPTCHA v2   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────┐
│                  Next.js API Routes (Edge / Node)            │
│  /api/tasks · /api/points · /api/withdrawals · /api/admin   │
│  Validación JWT · Rate limiting · Lógica anti-fraude        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                        Supabase                              │
│  PostgreSQL · Auth · Row Level Security · Realtime           │
└─────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                      TON Blockchain                          │
│  Toncenter API · TON Connect · Verificación de transacciones│
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Módulos y Funcionalidades

### 4.1 Autenticación y Registro

#### Métodos de acceso
- **Email + contraseña** (Supabase Auth nativo)
- **Google OAuth** (Supabase Auth Social Providers)

#### Campos obligatorios del perfil (completar tras el primer login)

| Campo | Tipo | Validación |
|---|---|---|
| `full_name` | string | Requerido, mín. 3 caracteres |
| `email` | string | Único, formato válido |
| `phone` | string | Formato E.164, único |
| `ton_wallet` | string | Formato de dirección TON válida (UQ.../EQ...) |
| `country` | string | Requerido |

> **Nota:** Hasta que el usuario no complete todos sus datos, no puede iniciar tareas.

#### Flujo de registro

1. El usuario crea una cuenta (email/Google).
2. Se redirige a `/onboarding` para completar datos reales.
3. El sistema registra la IP de registro para comparación futura.
4. Se valida que la dirección TON no exista en ninguna otra cuenta.

---

### 4.2 Dashboard del Usuario

Página principal del usuario autenticado. Muestra:

- **Puntos acumulados** y su equivalencia actual en TON.
- **Tareas completadas hoy** vs. **tareas disponibles** (barra de progreso).
- **Lista de tareas del día** con su estado: pendiente, completada, bloqueada.
- **Historial rápido** de las últimas 5 transacciones de puntos.
- **Botón de solicitar retiro** (habilitado si se cumple el mínimo).
- **Contador de reset diario** (hora en que se vuelven a habilitar las tareas).

---

### 4.3 Sistema de Tareas (Direct Links)

#### Estructura de una tarea

Cada tarea corresponde a un **Adsterra Direct Link** configurado por el administrador.

| Propiedad | Descripción |
|---|---|
| `id` | UUID único de la tarea |
| `title` | Nombre descriptivo del anuncio |
| `url` | URL del Direct Link de Adsterra |
| `exposure_seconds` | Segundos de exposición requeridos (por defecto: 30) |
| `points_reward` | Puntos que otorga al completarse |
| `is_active` | Si la tarea está habilitada |
| `daily_limit_per_user` | Veces que un usuario puede completarla por día (siempre 1) |

#### Límite diario

- Cada usuario puede completar entre **15 y 20 tareas por día** (configurable por el admin).
- El conteo se resetea a medianoche en la zona horaria del servidor (UTC).
- Las tareas no completadas **no se acumulan** para el día siguiente.

#### Flujo de una tarea

```
[Usuario hace clic en "Iniciar tarea"]
        │
        ▼
[Backend registra task_session con timestamp de inicio + IP]
        │
        ▼
[Se abre el Direct Link en nueva pestaña]
        │
        ▼
[Frontend muestra countdown de 30 segundos]
        │
        ▼
[A los 30s: se habilita el botón "Completar tarea"]
        │
        ▼
[Usuario hace clic en "Completar tarea"]
        │
        ▼
[Se muestra reCAPTCHA v2]
        │
        ▼
[Backend valida: tiempo transcurrido ≥ 30s + CAPTCHA token válido + no duplicado]
        │
      ┌─┴────────────────┐
    [OK]               [FALLO]
      │                   │
      ▼                   ▼
[Se acreditan        [Se muestra error,
  los puntos]         no se acredita nada]
```

---

### 4.4 Contador de 30 Segundos y Validación Backend

#### Frontend (UX)

- Countdown visual regresivo desde 30 hasta 0.
- El botón "Completar tarea" permanece **deshabilitado** durante el countdown.
- Si el usuario cierra la pestaña del anuncio antes de los 30s, el countdown sigue corriendo (la validación real es en backend).

#### Backend (Validación real)

Cuando el usuario envía la solicitud de completar la tarea, el API route verifica:

```typescript
// Pseudocódigo del endpoint /api/tasks/[id]/complete
const session = await getTaskSession(userId, taskId);
const elapsed = Date.now() - session.started_at;
const REQUIRED_MS = task.exposure_seconds * 1000; // 30000ms

if (elapsed < REQUIRED_MS) {
  return { error: "Tiempo insuficiente", code: "TIME_NOT_MET" };
}
```

- El `started_at` se registra en el servidor al momento de iniciar, nunca lo controla el cliente.
- Un `task_session` solo puede completarse **una vez**. Intentos duplicados son rechazados.
- Si el `task_session` tiene más de **10 minutos** desde su inicio sin completarse, expira y no se puede completar.

---

### 4.5 Sistema CAPTCHA

- Se usa **Google reCAPTCHA v2** ("No soy un robot").
- El token del CAPTCHA se genera en el frontend y se envía al backend.
- El backend lo valida contra la **API de Google** antes de acreditar puntos:

```typescript
const verifyUrl = `https://www.google.com/recaptcha/api/siteverify`;
const response = await fetch(verifyUrl, {
  method: "POST",
  body: new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET_KEY,
    response: captchaToken,
    remoteip: userIp,
  }),
});
const { success } = await response.json();
if (!success) return { error: "CAPTCHA inválido" };
```

- Si el CAPTCHA falla, los puntos **no se acreditan** y la tarea queda como no completada.
- El usuario puede reintentar el CAPTCHA sin perder la sesión de la tarea (mientras no haya expirado).

---

### 4.6 Sistema de Puntos

#### Configuración (gestionada por Admin)

| Parámetro | Descripción | Ejemplo |
|---|---|---|
| `points_per_task` | Puntos base por tarea completada | 100 pts |
| `ton_per_point` | Equivalencia TON por punto | 0.00001 TON |
| `min_withdrawal_points` | Mínimo para solicitar retiro | 10,000 pts |
| `daily_task_limit` | Máximo de tareas diarias | 15–20 |

#### Acreditación de puntos

Los puntos se acreditan de forma **atómica** usando una transacción en Supabase:

1. Se crea un registro en `point_transactions` (tipo: `EARN`).
2. Se actualiza `users.total_points` con `+= points_reward`.
3. Se marca `task_sessions.status = 'COMPLETED'`.

Si cualquier paso falla, se hace rollback completo y los puntos no se acreditan.

#### Puntos variables por exposición (opcional/configurable)

El admin puede configurar tareas con diferentes duraciones y recompensas:

| Exposición | Puntos |
|---|---|
| 30 segundos | 100 pts |
| 60 segundos | 220 pts |
| 120 segundos | 500 pts |

---

### 4.7 Sistema de Retiros en TON

#### Flujo de retiro manual

1. El usuario accede a `/dashboard/withdraw`.
2. El sistema verifica que `total_points >= min_withdrawal_points`.
3. El usuario ingresa el monto en puntos a retirar (con preview de TON equivalente).
4. El usuario confirma: se crea una `withdrawal_request` con estado `PENDING`.
5. El **administrador** revisa y aprueba/rechaza la solicitud en el panel admin.
6. Tras aprobación, el admin registra el hash de la transacción TON.
7. El sistema descuenta los puntos del saldo del usuario.
8. El usuario recibe una notificación (email o in-app).

#### Estados de una solicitud de retiro

```
PENDING → APPROVED → COMPLETED
         → REJECTED
```

#### Dirección TON

- La dirección TON registrada en el perfil del usuario es la **única** que recibe los fondos.
- El admin no puede cambiar la dirección; solo el usuario puede hacerlo (con reconfirmación de contraseña).
- **No se procesan retiros si la dirección TON ha sido marcada como sospechosa.**

---

### 4.8 Historial de Actividad

El usuario tiene acceso a `/dashboard/history` con tres pestañas:

#### Pestaña 1: Tareas completadas

| Columna | Descripción |
|---|---|
| Fecha/hora | Timestamp de completado |
| Nombre de tarea | Título del anuncio |
| Puntos ganados | Monto acreditado |
| Estado | Completado / Fallido |

#### Pestaña 2: Movimientos de puntos

| Columna | Descripción |
|---|---|
| Fecha/hora | Timestamp |
| Tipo | EARN / WITHDRAW / BONUS / PENALTY |
| Monto | Puntos |
| Balance resultante | Saldo tras el movimiento |

#### Pestaña 3: Retiros

| Columna | Descripción |
|---|---|
| Fecha solicitud | Timestamp |
| Puntos retirados | Monto |
| TON equivalente | Monto |
| Estado | Pendiente / Aprobado / Completado / Rechazado |
| Hash de TX | Enlace al explorador de TON |

---

### 4.9 Panel de Administración

Accesible solo por usuarios con rol `ADMIN`. Ruta: `/admin`.

#### Secciones del panel

##### A. Gestión de Tareas (Direct Links)

- Listar, crear, editar y desactivar tareas.
- Campos: título, URL de Adsterra, segundos de exposición, puntos de recompensa, estado activo/inactivo.
- Reordenar la lista de tareas.
- Activar/desactivar tareas sin eliminarlas.
- Vista previa del direct link.

##### B. Gestión de Usuarios

- Listado paginado con filtros (país, estado, fecha de registro).
- Ver perfil completo, puntos, historial de tareas y retiros.
- Banear/desbanear usuarios.
- Agregar notas internas sobre un usuario.
- Ver IPs registradas del usuario.

##### C. Gestión de Retiros

- Listado de solicitudes con filtros por estado.
- Aprobar retiro: ingresar hash de transacción TON y confirmar.
- Rechazar retiro con motivo.
- Exportar listado a CSV.

##### D. Configuración del Sistema

| Parámetro | Editable |
|---|---|
| Equivalencia TON/punto | ✅ |
| Puntos mínimos para retiro | ✅ |
| Límite de tareas diarias | ✅ |
| reCAPTCHA habilitado | ✅ |
| Mantenimiento (bloquea tareas) | ✅ |
| Mensaje de aviso global (banner) | ✅ |

##### E. Dashboard de métricas

- Total de usuarios registrados.
- Tareas completadas hoy / semana / mes.
- Puntos emitidos vs. puntos retirados.
- TON pagado en retiros.
- Usuarios activos por día (gráfico).
- Top 10 usuarios por puntos.

---

### 4.10 Sistema Anti-Fraude

#### Detección de cuentas múltiples

| Señal | Acción |
|---|---|
| Misma IP en registro + otra cuenta | Marcar como sospechoso, notificar admin |
| Misma billetera TON en otra cuenta | Bloquear registro, mostrar error |
| Mismo número de teléfono | Bloquear registro |
| Mismo email | Bloquear registro (Supabase lo maneja) |

#### Validación de sesiones de tareas

- Cada `task_session` está vinculada a un `user_id` + `task_id` + `date`.
- Solo puede existir **una sesión activa** por combinación en el día.
- Si se detecta un segundo intento de inicio de la misma tarea en el mismo día, se rechaza.

#### Rate limiting en API

- Máximo **30 requests por minuto** por IP en endpoints de tareas.
- Máximo **5 intentos de CAPTCHA fallido** por sesión antes de bloquear temporalmente.

#### Análisis de comportamiento

- Si un usuario completa el mínimo exigido (30s) exactamente en todas sus tareas de forma repetida y consistente (sin variación), se marca para revisión manual.
- Se registra el `user_agent` en cada sesión para detectar bots.

#### Penalizaciones

| Infracción | Penalización |
|---|---|
| Intento de manipular el tiempo | Sesión invalidada + log |
| 3 CAPTCHA fallidos seguidos | Bloqueo de tareas por 1 hora |
| Cuenta duplicada confirmada | Ban permanente de ambas cuentas |
| Billetera TON reportada como fraudulenta | Ban + retiro cancelado |

---

## 5. Modelo de Base de Datos

### Tabla: `users` (extiende `auth.users` de Supabase)

```sql
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name       TEXT NOT NULL,
  phone           TEXT UNIQUE NOT NULL,
  ton_wallet      TEXT UNIQUE NOT NULL,
  country         TEXT NOT NULL,
  total_points    INTEGER DEFAULT 0,
  role            TEXT DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  status          TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BANNED', 'SUSPENDED')),
  is_flagged      BOOLEAN DEFAULT FALSE,
  registration_ip TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `tasks`

```sql
CREATE TABLE public.tasks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  url               TEXT NOT NULL,
  exposure_seconds  INTEGER DEFAULT 30,
  points_reward     INTEGER NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `task_sessions`

```sql
CREATE TABLE public.task_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id),
  task_id       UUID NOT NULL REFERENCES public.tasks(id),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  status        TEXT DEFAULT 'IN_PROGRESS'
                  CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'FAILED')),
  ip_address    TEXT,
  user_agent    TEXT,
  captcha_valid BOOLEAN DEFAULT FALSE,
  session_date  DATE DEFAULT CURRENT_DATE,
  UNIQUE (user_id, task_id, session_date)
);
```

### Tabla: `point_transactions`

```sql
CREATE TABLE public.point_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id),
  type            TEXT NOT NULL CHECK (type IN ('EARN', 'WITHDRAW', 'BONUS', 'PENALTY')),
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  reference_id    UUID,  -- task_session_id o withdrawal_request_id
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `withdrawal_requests`

```sql
CREATE TABLE public.withdrawal_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id),
  points_amount   INTEGER NOT NULL,
  ton_amount      NUMERIC(18, 9) NOT NULL,
  ton_rate        NUMERIC(18, 9) NOT NULL,  -- Tasa al momento de la solicitud
  ton_wallet      TEXT NOT NULL,
  status          TEXT DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED')),
  tx_hash         TEXT,  -- Hash de la transacción en TON
  admin_notes     TEXT,
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);
```

### Tabla: `system_config`

```sql
CREATE TABLE public.system_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Valores iniciales
INSERT INTO public.system_config (key, value, description) VALUES
  ('ton_per_point',          '0.00001',   'Equivalencia TON por punto'),
  ('min_withdrawal_points',  '10000',     'Mínimo de puntos para retirar'),
  ('daily_task_limit',       '15',        'Máximo de tareas por día por usuario'),
  ('maintenance_mode',       'false',     'Modo mantenimiento activo'),
  ('recaptcha_enabled',      'true',      'reCAPTCHA obligatorio'),
  ('global_banner_message',  '',          'Mensaje de aviso global (vacío = oculto)');
```

### Tabla: `fraud_flags`

```sql
CREATE TABLE public.fraud_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id),
  reason      TEXT NOT NULL,
  details     JSONB,
  resolved    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabla: `ip_registry`

```sql
CREATE TABLE public.ip_registry (
  ip_address  TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.users(id),
  seen_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ip_address, user_id)
);
```

---

## 6. API Endpoints

Todos los endpoints están bajo `/api/` (Next.js API Routes). Requieren JWT salvo que se indique lo contrario.

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Registro con email/contraseña |
| `POST` | `/api/auth/login` | Login con email/contraseña |
| `GET` | `/api/auth/google` | Inicio de flujo OAuth Google |
| `POST` | `/api/auth/logout` | Cierre de sesión |
| `PUT` | `/api/auth/profile` | Actualización del perfil del usuario |

### Tareas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/tasks` | Listar tareas disponibles del día |
| `POST` | `/api/tasks/[id]/start` | Iniciar una sesión de tarea |
| `POST` | `/api/tasks/[id]/complete` | Completar tarea (valida tiempo + CAPTCHA) |
| `GET` | `/api/tasks/daily-status` | Estado de tareas del día del usuario |

### Puntos y Retiros

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/points/balance` | Saldo actual de puntos |
| `GET` | `/api/points/history` | Historial de movimientos de puntos |
| `POST` | `/api/withdrawals` | Crear solicitud de retiro |
| `GET` | `/api/withdrawals` | Listar solicitudes del usuario |

### Admin (requiere rol ADMIN)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/admin/tasks` | Listar todas las tareas |
| `POST` | `/api/admin/tasks` | Crear tarea |
| `PUT` | `/api/admin/tasks/[id]` | Editar tarea |
| `DELETE` | `/api/admin/tasks/[id]` | Desactivar tarea |
| `GET` | `/api/admin/users` | Listar usuarios con filtros |
| `PUT` | `/api/admin/users/[id]/ban` | Banear/desbanear usuario |
| `GET` | `/api/admin/withdrawals` | Listar retiros con filtros |
| `PUT` | `/api/admin/withdrawals/[id]/approve` | Aprobar retiro |
| `PUT` | `/api/admin/withdrawals/[id]/reject` | Rechazar retiro |
| `GET` | `/api/admin/config` | Obtener configuración del sistema |
| `PUT` | `/api/admin/config` | Actualizar configuración |
| `GET` | `/api/admin/metrics` | Métricas del dashboard |
| `GET` | `/api/admin/fraud-flags` | Ver alertas de fraude |

---

## 7. Flujo Completo del Usuario

```
1. REGISTRO
   └── Crear cuenta (email o Google)
   └── Completar perfil: nombre, teléfono, billetera TON
   └── Sistema valida unicidad de teléfono y billetera TON

2. LOGIN
   └── Acceder con credenciales o Google
   └── Redirigir a /dashboard

3. DASHBOARD
   └── Ver tareas disponibles del día
   └── Ver puntos acumulados y equivalencia en TON

4. INICIAR TAREA
   └── Hacer clic en "Iniciar" en una tarea
   └── Backend crea task_session con timestamp
   └── Se abre el Direct Link en nueva pestaña
   └── Frontend inicia countdown de 30 segundos

5. COMPLETAR TAREA
   └── A los 30s, se habilita el botón "Completar"
   └── Usuario hace clic en "Completar"
   └── Se muestra reCAPTCHA v2
   └── Usuario completa el CAPTCHA
   └── Backend valida:
         ✅ Tiempo transcurrido ≥ 30s
         ✅ Token CAPTCHA válido en Google
         ✅ Sesión no duplicada ni expirada
         ✅ Límite diario no alcanzado
   └── Puntos acreditados al instante

6. SOLICITAR RETIRO
   └── Navegar a /dashboard/withdraw
   └── Ingresar cantidad de puntos a retirar
   └── Ver equivalencia en TON
   └── Confirmar solicitud
   └── Esperar aprobación del admin

7. RETIRO PROCESADO
   └── Admin aprueba y registra hash TON
   └── Puntos descontados del saldo
   └── Usuario recibe notificación
```

---

## 8. Reglas de Negocio

1. Un usuario **no puede completar la misma tarea más de una vez por día**.
2. El máximo de tareas completadas por día es igual al número de tareas activas (15–20), configurable por el admin.
3. Los puntos **solo se acreditan** si se cumplen las tres condiciones: tiempo ≥ 30s + CAPTCHA válido + sesión no expirada.
4. Una `task_session` **expira** si no se completa en 10 minutos desde su inicio.
5. El saldo de puntos **nunca puede ser negativo**.
6. No se pueden solicitar retiros mientras haya una solicitud `PENDING` activa.
7. La tasa de conversión TON/punto se fija al momento de la solicitud de retiro y no cambia aunque el admin la modifique después.
8. El admin puede desactivar tareas sin eliminarlas; las sesiones ya iniciadas de esa tarea siguen siendo válidas.
9. Un usuario baneado pierde acceso inmediato pero sus puntos y datos quedan en el sistema para auditoría.
10. El límite diario se resetea a las **00:00 UTC**.

---

## 9. Seguridad

### Autenticación y autorización

- Todos los endpoints protegidos validan el JWT de Supabase en cada request.
- Las rutas `/admin/*` verifican que el `role` del usuario sea `ADMIN` mediante Row Level Security (RLS) en Supabase y middleware de Next.js.

### Protección contra manipulación de tiempo

- El timestamp de inicio (`started_at`) se almacena en el servidor, nunca en el cliente.
- El cliente **no puede enviar** su propio timestamp; el backend calcula el delta.

### Protección de datos

- Las contraseñas las gestiona Supabase Auth (bcrypt).
- La billetera TON y el teléfono se almacenan cifrados en la base de datos.
- Los logs de sesión incluyen IP y user_agent para auditoría.

### Headers de seguridad (next.config.js)

```javascript
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "..." },
];
```

### Row Level Security en Supabase

- Los usuarios solo pueden leer y escribir **sus propios datos**.
- Los registros de admin solo son accesibles con rol `ADMIN`.
- La tabla `system_config` es de solo lectura para usuarios normales.

---

## 10. Estructura de Carpetas del Proyecto

```
tontap/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── onboarding/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── dashboard/tasks/page.tsx
│   │   ├── dashboard/history/page.tsx
│   │   └── dashboard/withdraw/page.tsx
│   ├── (admin)/
│   │   ├── admin/page.tsx
│   │   ├── admin/tasks/page.tsx
│   │   ├── admin/users/page.tsx
│   │   ├── admin/withdrawals/page.tsx
│   │   └── admin/config/page.tsx
│   ├── api/
│   │   ├── auth/
│   │   ├── tasks/
│   │   ├── points/
│   │   ├── withdrawals/
│   │   └── admin/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── tasks/
│   │   ├── TaskCard.tsx
│   │   ├── TaskTimer.tsx
│   │   └── CaptchaModal.tsx
│   ├── dashboard/
│   │   ├── PointsBalance.tsx
│   │   ├── DailyProgress.tsx
│   │   └── WithdrawForm.tsx
│   └── admin/
│       ├── TaskForm.tsx
│       ├── UserTable.tsx
│       └── WithdrawalQueue.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── ton/
│   │   ├── wallet.ts
│   │   └── transaction.ts
│   ├── fraud/
│   │   └── detector.ts
│   └── utils/
│       ├── points.ts
│       └── time.ts
├── hooks/
│   ├── useTaskTimer.ts
│   ├── usePoints.ts
│   └── useWithdrawals.ts
├── types/
│   └── index.ts
├── middleware.ts           # Protección de rutas + rate limiting
├── next.config.js
├── tailwind.config.ts
└── .env.local
```

---

## 11. Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Google OAuth (configurado en Supabase Dashboard)
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Le...
RECAPTCHA_SECRET_KEY=6Le...

# TON
TON_API_KEY=...                   # Toncenter API key
TON_NETWORK=mainnet               # mainnet | testnet
ADMIN_TON_WALLET=EQ...            # Billetera del admin para envío

# App
NEXT_PUBLIC_APP_URL=https://tontap.app
```

---

## 12. Consideraciones de Despliegue

### Vercel

- Conectar el repositorio de GitHub a Vercel.
- Configurar las variables de entorno en el panel de Vercel.
- Habilitar **Edge Middleware** para el rate limiting y protección de rutas.

### Supabase

- Activar **Row Level Security** en todas las tablas desde el inicio.
- Configurar el proveedor de Google OAuth en `Authentication > Providers`.
- Programar un **cron job** (via Supabase Edge Functions o servicio externo) que expire las `task_sessions` con más de 10 minutos de antigüedad en estado `IN_PROGRESS`.
- Habilitar **Supabase Realtime** en `task_sessions` y `point_transactions` para actualizaciones en vivo en el dashboard.

### Dominio y SSL

- Configurar dominio personalizado en Vercel.
- SSL automático via Let's Encrypt (Vercel lo gestiona).

### Monitoreo

- Integrar **Sentry** para tracking de errores en frontend y API routes.
- Usar **Vercel Analytics** para métricas de rendimiento.
- Configurar alertas en Supabase para consultas lentas o errores de autenticación masivos.

---

*TonTap — Documento de especificación técnica — Versión 1.0*
*Actualizar conforme evolucione el proyecto.*
