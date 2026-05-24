# TonTap — Mobile CSS Fix: Instrucciones de aplicación

## Archivos a reemplazar

| Archivo en el repo | Archivo corregido aquí |
|----|-----|
| `src/app/(admin)/admin/page.tsx` | `admin-page.tsx` |
| `src/app/layout.tsx` | `layout.tsx` |
| `src/app/globals.css` | `globals.css` |
| `next.config.ts` | `next.config.ts` |

---

## Resumen de los 3 bugs raíz

### Bug 1 — Clases Tailwind dinámicas (causa principal)
**Archivo:** `src/app/(admin)/admin/page.tsx`

Tailwind v4 hace un análisis ESTÁTICO del código fuente en build time.
Cuando una clase se construye por interpolación de string:
```js
// ❌ ROTO — Tailwind nunca ve "bg-emerald-500/10" como string literal
`bg-${stat.color}-500/10`
`text-${stat.color}-500`
```
...esa clase NUNCA se emite en el bundle CSS final.

En desktop puede funcionar por caché del navegador de sesiones anteriores.
En móvil (fresh install, sin caché) las clases simplemente no existen → componentes sin color/fondo.

**Fix:** Reemplazar con un mapa estático de clases:
```js
// ✅ CORRECTO — Tailwind ve las clases completas en el objeto
const colorConfig = {
  emerald: { icon: 'text-emerald-500 bg-emerald-500/10' },
  blue:    { icon: 'text-blue-500 bg-blue-500/10' },
  ...
}
```

### Bug 2 — `viewport` mal exportado en layout.tsx
**Archivo:** `src/app/layout.tsx`

```js
// ❌ ROTO — Next.js 15 ignora esta forma y no emite el viewport meta tag correctamente
export const viewport = { width: 'device-width', initialScale: 1, ... }
```

Sin el meta viewport correcto, los navegadores móviles renderizan en modo "desktop"
(viewport de ~980px) y escalan hacia abajo, lo que hace que muchas media queries
de Tailwind (`md:`, `lg:`) no activen en el tamaño correcto.

**Fix:**
```js
// ✅ CORRECTO — importar el tipo Viewport y tipar correctamente
import type { Metadata, Viewport } from "next";
export const viewport: Viewport = { width: 'device-width', initialScale: 1, ... }
```

### Bug 3 — Sin safelist en Tailwind v4
**Archivo:** `src/app/globals.css`

Además de las clases dinámicas en admin/page.tsx, otros archivos pueden tener
clases que Tailwind no detecta. El `@source inline(...)` en globals.css actúa
como safelist explícito: fuerza la emisión de esas clases en el CSS final,
independientemente de cómo aparezcan en el código.

### Bug 4 — optimizeCss en next.config.ts
**Archivo:** `next.config.ts`

Next.js tiene una optimización experimental de CSS que puede dividir el CSS en
chunks y omitir chunks que considera "no críticos" para el initial load.
En móviles con conexiones lentas esto puede causar FOUC (Flash of Unstyled Content)
o directamente no cargar ciertos estilos. Se desactiva con `optimizeCss: false`.
