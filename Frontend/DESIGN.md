# KeptAI · Sistema de diseño y dirección visual

Rediseño sobrio de grado producto financiero para Corpotex y confeccionistas textiles en Piura.
Enfoque en claridad operativa, densidad controlada y leyes de la Gestalt (proximidad, región común, figura-fondo y límite de carga cognitiva 7 ± 2).

## 1. Principios del rediseño
- **Herramienta de trabajo, no plantilla de IA:** se retiraron los fondos degradados pastel con esferas, las sombras flotantes de fantasía, las píldoras en todos los controles y los acentos violeta chillones. La paleta sale del logo oficial de KeptAI (azul Hyper Blue #03509B y Black Sea Night #00285F, verde Herbal y amarillo Spicy Sweetcorn), con grises neutros y estados de auditoría transparentes.
- **Ley de Hick y Gestalt (máximo 7 elementos focales):** cada pantalla prioriza una acción principal evidente. La navegación fija tiene entre 1 y 4 destinos por rol; los listados largos se paginan en bloques de 7 filas; las vistas densas como pedidos y clientes agrupan su información en pestañas semánticas (Pedido, Pagos, Seguimiento) para evitar fatiga cognitiva.
- **Acceso directo y honesto:** el login presenta el formulario en primer plano junto a la explicación del flujo de trabajo, eliminando modales de acceso innecesarios y estados intermedios.
- **Doble tema funcional (Claro y Oscuro):** selector de tema persistente en encabezado (`[data-theme="dark"]`) con contraste WCAG AA/AAA verificado en ambos modos, bordes de separación reales y sin inversión arbitraria de componentes.

## 2. Marca, paleta y tokens semánticos

### Logo
- Originales en `assets/` (raíz del repo): `isotipo.png`, `isotipo_sinfondo.png`, `logo_fondoBlanco.png`, `logo_sinfondo.png`.
- Copias web en `Frontend/public/brand/` (recortadas y reducidas a partir de `isotipo_sinfondo.png`): `isotipo-64/128/256.png`, `favicon-48.png` y `apple-touch-icon.png`.
- Componente `Logo`: isotipo en imagen + nombre en texto ("Kept" en `brand-word`, "AI" en `brand-yellow`) para que el nombre se lea en claro, oscuro y sobre el azul del login. El texto del logo PNG es azul marino y desaparece sobre fondos oscuros.

### Colores de marca (tokens `--color-brand-*`)
| Token | Hex | Nombre | Uso |
|---|---|---|---|
| `brand-blue` | `#03509B` | Hyper Blue | Acción principal, selección, información |
| `brand-navy` | `#00285F` | Black Sea Night | Hover de acción, "Kept" del logo, texto sobre amarillo |
| `brand-deep` | `#042450` | Subnautical | Panel azul del login (`navy`) |
| `brand-green` | `#21B090` | Herbal | Series de cobros/ingresos, barras "ok" (solo relleno: contraste 2,6:1 sobre blanco) |
| `brand-teal` | `#04685D` | Peacock Pride | Texto de estado aprobado/conciliado |
| `brand-yellow` | `#FAA901` | Spicy Sweetcorn | "AI" del logo, botón del login, barras de aviso (solo relleno o con texto `#00285F`) |

### Modo claro (Light)
- Fondo aplicación: `#F3F6FA`; paneles `#F6F9FC`; tarjetas `#FFFFFF` con borde `#D9E2ED`
- Tinta principal: `#0F2747` (13,8:1); secundario `#4D6280` (6,2:1); atenuado `#62758F` (4,7:1)
- Acción principal: `#03509B` (hover `#00285F`, texto `#FFFFFF`, 8:1)
- Selección: `#03509B` con tinte `#E2EDF8`
- Login: panel `#042450`, botón amarillo `#FAA901` con texto `#00285F` (7,3:1)

### Modo oscuro (Dark)
- Fondo aplicación: `#061629`; paneles `#0A1E36`; tarjetas `#0E2542` con borde `#24405F`
- Tinta principal: `#EAF1F9`; secundario `#A7B9CF`
- Acción principal: `#7FB8F0` (hover `#A7CFF6`, texto `#00285F`, 6,8:1)
- Selección: tinte `#163A62` con texto `#A7CFF6`

### Semáforo de estados
- Aprobado / Conciliado: `#04685D` / fondo `#E1F5EF` (oscuro: `#6FDCBF` / `#0F3D3A`)
- Advertencia / Por vencer: `#8A5A00` / fondo `#FFF3D6` (oscuro: `#FCC955` / `#3F3416`)
- Mora / Vencido / Error: `#B23A2F` / fondo `#FCEAE8` (oscuro: `#F3ADA5` / `#472E30`)
- Informativo: `#03509B` / fondo `#E2EDF8` (oscuro: `#7FB8F0` / `#163A62`)
- Gráfico de caja: ingresos `#21B090`, egresos `#03509B` (oscuro: `#4FC9A8` / `#7FB8F0`)

## 3. 🔤 Sistema de Tipografía

### 3.1. Familias Tipográficas (Font Stacks)
- **Sans-Serif Principal (UI & Dashboards):**
  ```css
  font-family: 'Inter', 'Source Sans Pro', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  ```
  - `Inter`: con soporte óptico (`opsz: 14..32`), única familia cargada (Google Fonts en `index.html`).
  - Las demás familias del stack son de sistema; no se descargan.
- **Monospace (códigos de pedido y pago, referencias de operación):**
  ```css
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  ```
- **Serif (Documentos / Reportes Formales):**
  ```css
  font-family: 'Merriweather', ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
  ```

### 3.2. Pesos Disponibles (Font Weights)
| Peso | Valor Numérico | Uso Común |
|---|---|---|
| Light | 300 | Subtítulos suaves, detalles decorativos |
| Regular | 400 | Texto corrido (body), párrafos, descripciones |
| Medium | 500 | Botones, labels de formulario, ítems de menú |
| Semi-Bold | 600 | Encabezados de tarjetas, títulos de sección, stats |
| Bold | 700 | Títulos principales (H1, H2), KPIs destacados |
| Extra-Bold | 800 | Números de impacto hero, banners principales |
| Black | 900 | Landing highlights |

### 3.3. Escala Tipográfica y Line-Height
| Clase | Tamaño (rem / px) | Line-Height | Uso en el Sistema |
|---|---|---|---|
| `text-xs` | 0.75rem (12px) | 1rem (16px) | Badges, tags, timestamps, texto de ayuda |
| `text-sm` | 0.875rem (14px) | 1.25rem (20px) | Labels de forms, celdas de tabla, botones |
| `text-base` | 1rem (16px) | 1.5rem (24px) | Texto base por defecto, párrafos descriptivos |
| `text-lg` | 1.125rem (18px) | 1.75rem (28px) | Subtítulos de sección, cabeceras de card |
| `text-xl` | 1.25rem (20px) | 1.75rem (28px) | Títulos de modales, sub-headers de módulo |
| `text-2xl` | 1.5rem (24px) | 2rem (32px) | Títulos de vista, números de resumen |
| `text-3xl` | 1.875rem (30px) | 2.25rem (36px) | Encabezado principal de página (H1) |
| `text-4xl` | 2.25rem (36px) | 2.5rem (40px) | Hero titles / landing banners |

### 3.4. Reglas Tipográficas Globales
- Suavizado de fuente activo: `antialiased` (`-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`).
- Títulos y encabezados usan kerning cerrado: `tracking-tight` (`letter-spacing: -0.025em;`).
- Elementos `<select>` y `<option>` mantienen capitalización natural (`text-transform: none`).

---

## 4. 📐 Sistema de Diseño (Estructura, Geometría y Layout)

### 4.1. Radios de Esquina (Border Radius)
- **Variable Base (`--radius`):** `0.75rem` (12px) en Frontend / `0.5rem` (8px) en Backend.
- `rounded-lg`: `var(--radius)` (12px). Tarjetas principales, modales, drawers.
- `rounded-md`: `calc(var(--radius) - 2px)` (10px). Botones, inputs, selects, dropdown menus.
- `rounded-sm`: `calc(var(--radius) - 4px)` (8px). Badges, tooltips, tags compactos.
- `rounded-full`: `9999px`. Avatares, switches, pills de estado, orbes flotantes.

### 4.2. Sombras y Elevación (Box Shadows)
- `shadow-soft`: `0 10px 30px rgba(15, 23, 42, 0.08)` (Tarjetas flotantes y paneles limpios).
- `card-hover`: `0 8px 30px rgba(0, 0, 0, 0.3)` acompañado de micro-desplazamiento vertical `translateY(-2px)`.
- **Elevaciones Estándar:** `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`.
- **Arrastre / Resize Grid:** `box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)`.

### 4.3. Layout y Grillas (Grid & Containers)
- **Contenedor Principal (`.main-container`, `.container`):** Centrado automático con padding horizontal de `2rem` (32px) y max-width en pantalla 2xl de `1400px`.
- **Breakpoints:**
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
  - `2xl`: 1400px
- **Columnas Especiales:**
- **Viewport Móvil:** Altura con soporte dinámico `min-height: 100svh` (fallback a `100vh`).

### 4.4. Ergonomía de Componentes (Dimensiones de Interfaz)
- **Botones:**
  - `sm`: Altura 36px (`h-9`), padding `px-3`, texto `text-sm`.
  - `default`: Altura 40px (`h-10`), padding `px-4 py-2`, texto `text-sm`.
  - `lg`: Altura 44px (`h-11`), padding `px-8`, texto `text-base`.
  - `icon`: 40px × 40px (`h-10 w-10`).
- **Inputs & Selects:** Altura base `h-9` o `h-10`, padding interno `px-3 py-2`, borde 1px.
- **Icon Circles:** Círculos estándar de 40px × 40px (`w-10 h-10 rounded-full flex items-center justify-center`).

### 4.5. Scrollbars y Transiciones
- **Scrollbar Personalizado:**
  - Ancho y alto: 6px.
  - Border radius de track y thumb: 3px.
- **Animaciones Definidas:**
  - Acordeones: `0.2s ease-out` (`accordion-down` y `accordion-up` basados en `var(--radix-accordion-content-height)`).
  - Hover en Cards: `transition: all 0.3s ease`.
  - Grid Dashboard: `transition: height 200ms ease`.
  - Burbujas decorativas: `float 8s ease-in-out infinite` con aceleración por GPU.

---

## 5. Accesibilidad y estándares técnicos
- Botones e interactivos con altura táctil mínima de 44px (`min-h-11`).
- Trampa de foco y retorno de foco con tecla `Escape` en todos los diálogos y menú lateral móvil.
- Atajo de accesibilidad para saltar al contenido principal (`.skip-link`).
- Navegación por teclado en pestañas y controles segmentados con flechas (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
- `prefers-reduced-motion` respetado en todas las transiciones y gráficos.
- Soporte para impresión (`@media print`) limpio sin barras laterales ni controles de interfaz.

## 6. Pulido final de la interfaz · 11/10/2026

Responsable de implementación: Codex, por solicitud del usuario, en la rama `frontend`.
Alcance: acabado visual de la aplicación existente. Se conservan arquitectura, rutas, roles,
fuentes de datos, cálculos y acciones. No es aprobación empresarial ni certificación del backend.

### Criterios de cierre y decisiones visuales

- **Identidad conservada:** azul de marca, Manrope, iconos Phosphor y ambos temas; dan continuidad a lo que ya usa el equipo. Energía 1, ritmo 1 y movimiento 1: una herramienta operativa tranquila.
- **Encabezados comunes:** título, contexto y acciones se separan del contenido por un borde; las acciones se distribuyen en varias líneas cuando falta ancho, sin comprimir la descripción.
- **Pedidos en móvil:** la misma tabla se presenta como filas de lectura vertical por debajo de 640px. Cliente, vencimiento, venta, saldo y estados permanecen visibles, con los mismos enlaces, búsqueda y paginación. Se conservan los roles semánticos de tabla.
- **Clientes:** el kanban conserva sus cuatro estados; usa dos columnas en anchos intermedios y cuatro desde 1536px. Los nombres se pueden leer completos. Los filtros y el buscador se apilan antes de quedar estrechos.
- **Alertas:** un borde y color semántico bastan para señalar el problema. Se retiran sombras y bordes redundantes; el texto sobre fondos de error usa `text-inverse` para mantener contraste en ambos temas.
- **Controles:** altura de al menos 44px en los controles ajustados, foco interior en filtros para que no se recorte al desplazarlos, sin salto vertical al pasar el cursor sobre botones.
- **Navegación:** barra lateral y menú móvil desplazables en pantallas bajas; el ancho reservado para la barra de desplazamiento evita saltos entre páginas cortas y largas.
- **Tablas financieras extensas:** se conserva la comparación por columnas; Resultado indica el desplazamiento en móvil y permite enfocarlo por teclado.
- **Movimiento reducido:** se conserva la configuración de Motion y se limita el ciclo CSS de animación cuando el sistema solicita menos movimiento.

### Fuentes y límites

- `cerebro/conocimientos/decisiones/decisiones-del-proyecto.md`, D-003: captura, conciliación, cobranza y caja como núcleo. Dirección del equipo, no nueva regla derivada del pulido.
- `cerebro/conocimientos/decisiones/roadmap-german-frontend.md`, contexto y usuarios: revisión humana, diferencias entre margen, cobro y caja. El alcance histórico de tres pantallas no se usa para retirar pantallas actuales.
- `cerebro/diagramas/keptai-der-v6.md`, «Lectura y alcance»: pedido, obligación y pago permanecen separados. No se modifican diagramas ni contratos de datos.
- `src/App.tsx`, `src/components/layout/Sidebar.tsx` y componentes de las páginas: evidencia de la estructura existente que se preserva, incluidos kanban y permisos actuales.

### Verificación local

Entorno: Chrome local, Vite en `127.0.0.1:5179`, `VITE_API_MODE=mock`, datos ficticios y sesiones aisladas de pruebas.

- Compilación de producción y TypeScript: PASS.
- Contrato frontend: 43/43 pruebas PASS.
- Recorrido funcional existente: 40/40 comprobaciones PASS, incluyendo conciliación, anticipo, despacho, crédito, permisos por rol y factor de cobro.
- Diseño: 76/76 comprobaciones PASS, con temas claro/oscuro, móvil de 360/390px, tablet de 768/1024px y escritorio de 1440px; búsqueda vacía, paginación, pestañas, foco de diálogos y menú móvil, sin errores de consola.
- Revisión visual de capturas: pedidos, clientes, conciliación y resumen en tamaños representativos. Capturas reproducibles en `e2e/shots/redesign/` (ignoradas por Git).

Esta evidencia valida el frontend con su fuente de demostración. No acredita integración real con Spring, Supabase ni un despliegue productivo.
