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

## 3. Tipografía y geometría
- **Familia:** Manrope Variable con soporte tabular estricto (`tabular-nums` / `tnum`) en todos los importes, códigos y fechas.
- **Escala de bordes y radios:**
  - Controles (botones, inputs, selectores): `8px` (`rounded-lg`)
  - Tarjetas y contenedores: `12px` (`rounded-xl`)
  - Modales: `12px`
  - Chips de estado: `6px` (`rounded-md`, eliminando la forma de cápsula universal)
- **Elevación y sombras:** bordes nítidos de 1px como estructura visual primaria; elevación reservada exclusivamente para diálogos modales y menús flotantes.

## 4. Accesibilidad y estándares técnicos
- Botones e interactivos con altura táctil mínima de 44px (`min-h-11`).
- Trampa de foco y retorno de foco con tecla `Escape` en todos los diálogos y menú lateral móvil.
- Atajo de accesibilidad para saltar al contenido principal (`.skip-link`).
- Navegación por teclado en pestañas y controles segmentados con flechas (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
- `prefers-reduced-motion` respetado en todas las transiciones y gráficos.
- Soporte para impresión (`@media print`) limpio sin barras laterales ni controles de interfaz.
