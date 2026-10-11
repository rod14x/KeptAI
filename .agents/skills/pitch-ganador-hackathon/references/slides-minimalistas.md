# Diapositivas minimalistas para pitch

Las diapositivas no son el pitch: son el anclaje visual de lo que dices. Si el jurado lee, no te escucha. Por eso: una idea por diapositiva y menos de 30 palabras.

## Reglas
- **Fondo blanco y letra oscura** (cuando el usuario lo pida o no haya marca). Un solo color de acento para cifras o la palabra clave, usado con moderación.
- **Jerarquía de tamaños marcada:** la cifra o la frase clave enorme; el apoyo, pequeño. Si todo es del mismo tamaño, nada destaca.
- **Menos de 30 palabras por diapositiva.** Titulares, no párrafos. La fuente de un dato va en una línea pequeña al pie.
- **Apertura y cierre con la misma composición** (texto gigante centrado), para que el cierre se sienta como el espejo del inicio.
- **Sin fotos de stock ni íconos decorativos.** Si hay un ícono, va con una etiqueta de texto al lado.
- **Una diapositiva por bloque del guion**, y las notas del orador llevan el texto y las acotaciones.
- **Color nunca solo:** un estado o una diferencia también se dicen con texto.

## Contraste: calcúlalo, no lo supongas
Mínimos WCAG AA: 4,5:1 para texto normal y 3:1 para texto grande (más de 18 px o 24 px en negrita). Fórmula en `antislop-human` o con este patrón: luminancia relativa de cada color (canal/255 linealizado, ponderado 0,2126 / 0,7152 / 0,0722) y razón (L1 + 0,05) / (L2 + 0,05).

Valores ya calculados para una paleta de fondo blanco:

| Texto sobre blanco | Razón | Texto normal (4,5) |
|---|---|---|
| #111827 (casi negro) | 17,74 | Pasa |
| #4B5563 (gris oscuro) | 7,56 | Pasa |
| #6B7280 (gris medio) | 4,83 | Pasa, al límite |
| #B3261E (rojo oscuro, acento) | 6,54 | Pasa |
| #9CA3AF (gris claro) | 2,54 | Falla |

Para paleta oscura, que sirve en salas con proyector fuerte: blanco sobre #0B1F3A da 16,52; ámbar #FFC247 sobre #0B1F3A da 10,27 (pasa), pero **ámbar sobre blanco da 1,61 y falla**. Los grises claros sobre blanco fallan casi siempre.

## Cómo generarlas
- **Canva conectado:** usa `create-design` con formato "Presentation (16:9 landscape)", un `brief` que repita estas reglas (fondo blanco, acento único, menos de 30 palabras, sin fotos de stock, apertura y cierre idénticos en composición) y un `outline` con una sección por diapositiva, con el texto exacto que debe aparecer. Si el resultado no devuelve un widget, espera lo que indique `polling_policy` y consulta `get-create-design-async-job`. Abre el resultado y revisa el diseño antes de darlo por bueno: no puedes confiar en que Canva respete el límite de palabras.
- **Sin Canva:** usa el tipo "Slides" de artefactos, con las notas del orador por diapositiva.
- Revisa a mano: máximo 30 palabras por diapositiva, cifra legible desde el fondo de la sala, apertura y cierre iguales.

## Esquema de diapositivas (3 minutos)
1. Pregunta de apertura o frase de la historia. 2. Cifra de silencio. 3. Cifra de escalada. 4. Calidad de vida (si hay historia personal, puede fusionarse con la 1). 5. Pregunta puente. 6. Nombre y gesto de la solución. 7. Diferencial en 3. 8. Comunidad con la nota "previsto" si no está firmado. 9. Gratis para ti / quién paga. 10. Cierre en espejo con el pedido.

## Referentes de decks (qué tomar de cada uno)
- **Deck de color audaz (estilo Chuckle):** bloques de color, números gigantes, una diapositiva de equipo y una diapositiva de un solo color con una frase. Toma de aquí la diapositiva de color pleno para el momento wow y la cifra gigante.
- **Deck editorial azul y blanco:** tipografía monoespaciada, trazos a mano, mucho aire. Toma el espacio en blanco y un solo acento; sirve con el fondo blanco de esta guía.
- **Marco de cuatro etapas** (preparar el escenario, mostrar lo construido, probar que funciona, el pedido): se corresponde con CAPTA, SOSTIENE y CIERRA. Añade al esquema de arriba una diapositiva de **tamaño de mercado** (una línea, con fuente), una de **validación o tracción** (en etapa de idea: lo que ya probaron o conversaron) y una de **equipo** con los integrantes y su rol.
- Un solo estilo por deck: elige un referente y no mezcles los tres.
- Si hay un video, la diapositiva va sin texto, con el rótulo "Prototipo" si es una simulación.
