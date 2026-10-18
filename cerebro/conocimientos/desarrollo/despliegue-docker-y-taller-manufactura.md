# Guia de Despliegue Docker All-in-One y Modulo de Taller Textil (Corpotex)

> **Documento de Conocimiento Tecnico y Operativo - KeptAI**  
> **Fecha:** 18 de octubre de 2026  
> **Autores / Responsables:** Isabella (Frontend, Despliegue & Procesos de Manufactura), Miguel (Backend & Seguridad), Andres (Base de Datos & Flyway).

---

## 1. Arquitectura de Despliegue: Contenedor All-in-One

### 1.1 Vision General del Contenedor
Para facilitar el despliegue en el VPS mediante **Portainer** sin requerir multiples servicios fragmentados ni configuracion manual de CORS entre contenedores, se implemento una imagen **All-in-One** multietapa (`Dockerfile`):

- **Nginx Interno (Puerto 80):** Sirve la SPA de React/Vite compilada y actua como reverse proxy local hacia `http://127.0.0.1:8080` para `/api/` y `/actuator/`.
- **Backend Spring Boot (Puerto 8080):** Ejecuta Java 21 Temurin con perfil dev/prod y gestiona la seguridad JWT, persistencia y motores financieros.
- **Conectividad:**
  - Puerto `8086:80` publicado en el host del VPS para acceso directo por IP.
  - Red externa `public` conectada para enrutamiento por dominio virtual (`VIRTUAL_HOST`, `LETSENCRYPT_HOST`) con SSL automatico de Let's Encrypt.

### 1.2 Regla de "pull_policy: build" (Solucion al error de Docker Hub)
- **Problema encontrado:** Si en el `compose.yaml` se especifica `image: keptai:latest`, al actualizar el stack desde Portainer con la opcion *"Re-pull image"* activada, Docker intenta consultar Docker Hub (`docker.io/library/keptai`) y falla con `pull access denied for keptai`.
- **Regla:**  
  1. Se elimino la directiva `image: keptai:latest`.
  2. Se configuro `container_name: keptai` y `pull_policy: build`.
  3. En la interfaz de Portainer, al hacer **Update the stack**, se debe mantener **desactivado (OFF)** el toggle de *"Re-pull image"*.

### 1.3 Cero Secretos en Git
- No se versionan archivos `.env` (bloqueados en `.gitignore`).
- No se queman correos personales ni dominios privados en los archivos del repositorio.
- Todas las variables se configuran en la interfaz de Portainer (seccion Environment variables del Stack).

---

## 2. Modulo de Manufactura Textil en Taller (/taller)

Corpotex opera con dos modelos productivos distintos que deben ser reflejados tanto en costos, inventarios y tiempos de entrega.

### 2.1 Las Dos Modalidades de Operacion
1. **Stock Base en Blanco (Prenda Confeccionada):**
   - La empresa ya cuenta con prendas lisas en almacen (ej. Polo Jersey 30/1 Blanco, Camisa Oxford Blanco, Polera Franela).
   - **Ruta de produccion reducida:** No pasa por Corte ni Confeccion general; ingresa directamente a **Sublimacion / Estampado** o **Bordado Computarizado**.
   - **Descuento de Stock:** Se descuentan directamente las unidades lisas del inventario de prendas terminadas en 1 clic.
   - **Margen y Costo:** Costo base de la prenda + insumos de personalizacion (tintas, hilos) + mano de obra directa de estampado.
2. **Confeccion Completa (Full Package / Desde Rollo):**
   - Fabricacion a medida desde la tela cruda o teñida.
   - **Ruta completa de 6 etapas:**
     1. *Corte & Tizado:* Tendido de rollos (Kg), tizado computarizado y corte de piezas.
     2. *Sublimacion / Estampado:* Estampado en piezas abiertas antes del cerrado.
     3. *Bordado Computarizado:* Aplicacion de escudos o logotipos de alta puntada.
     4. *Costura & Ensamble:* Remalle, recubierto y pegado de cuellos/mangas.
     5. *Control de Calidad (AQL 2.5):* Limpieza de hilachas, medicion de tallas y desmanchado.
     6. *Listo para Despacho:* Doblado, embolsado individual e ingreso a embalaje.
   - **Descuento de Stock:** Se descuentan Kilogramos (Kg) del rollo de tela, metros de rib y conos de hilo.

### 2.2 Ficha Tecnica Textil (FichaTecnicaModal.tsx)
- Curva de tallas detallada (XS, S, M, L, XL, XXL).
- Especificacion de tela (Composicion, Gramaje en g/m², Color Pantone).
- Ubicacion milimetrica de arte (Pecho centro, Pecho izquierdo, Espalda alta, Manga).
- Estilos de impresion listos para imprenta (`@media print` optimizado para ordenes de taller fisicas).

### 2.3 Modulo de Control de Inventario de Planta (TallerInventoryView.tsx)
- Monitor en tiempo real de:
  - **Prendas Base en Blanco:** Polos Jersey 30/1, Poleras Franela 20/1, Camisas Oxford.
  - **Materia Prima en Rollos (Kg):** Jersey Algodon Pima, Franela Reactiva, Pique 24/1.
  - **Avios e Insumos:** Conos de Hilo 40/2, Tintas de Sublimacion CMYK, Bolsas de polietileno.
  - Alertas automaticas de stock critico y reposicion simulada.

---

## 3. Pruebas de Integracion y CI en GitHub Actions

### 3.1 Causa del Fallo en BackendCompletionIntegrationTests
En el workflow de CI (`.github/workflows/ci.yml`), el trabajo `Backend (Spring + PostgreSQL real)` ejecuta 357 pruebas unitarias e integradas contra una base PostgreSQL efimera levantada mediante **Testcontainers**.

La prueba `BackendCompletionIntegrationTests.verificationAndApplicationRequireDistinctAdminsAndReplayNeverAppliesTwice` fallaba con:
`Status expected:<200> but was:<409>`

**Causa Raiz:**
1. Al aplicarse el pago que cubre la orden, se activa `releaseCoveredOrder`, la cual fija:
   `fecha_inicio_produccion = coalesce(o.fecha_inicio_produccion, timezone(org.zona_horaria, now())::date)`
   En el entorno de CI, `now()` corresponde a la fecha actual (`2026-10-18`).
2. La prueba realizaba una peticion `POST /api/v1/orders/{id}/dispatch` con una fecha fija del pasado:
   `{"dispatch_date": "2026-10-11"}`
3. En la base de datos PostgreSQL, la migracion `V8__despacho_vencimiento_cobranza.sql` tiene el trigger `tg_despacho_vencimiento` que valida:
   `IF o.fecha_inicio_produccion IS NOT NULL AND NEW.fecha_despacho < o.fecha_inicio_produccion THEN RAISE EXCEPTION 'La fecha de despacho es anterior al inicio de produccion' USING ERRCODE='23514';`
4. Al ser `2026-10-11 < 2026-10-18`, PostgreSQL lanzaba la excepcion `23514` (Check Violation), provocando que Spring Boot respondiera con `409 Conflict`.

### 3.2 Correccion Implementada
Se actualizo `BackendCompletionIntegrationTests.java` para utilizar una fecha dinamica acorde a la zona horaria de la organizacion (`America/Lima`):
```java
String today = java.time.LocalDate.now(java.time.ZoneId.of("America/Lima")).toString();
for(int i = 0; i < 2; i++) {
  mvc.perform(post("/api/v1/orders/" + o + "/dispatch")
    .with(authentication(auth(ADMIN)))
    .contentType("application/json")
    .header("Idempotency-Key", "dispatch-demo")
    .content("{\"dispatch_date\":\"" + today + "\"}"))
    .andExpect(status().isOk());
}
```
Con este cambio, `fecha_despacho >= fecha_inicio_produccion` se cumple consistentemente sin importar en que fecha se ejecute el pipeline.

---

## 4. Resumen para el Equipo
| Componente | Responsable Principal | Estado | Verificacion |
|---|---|---|---|
| **Contenedor All-in-One** | Isabella | Listo y testeado | Puerto 8086 + Nginx + Spring Boot funcionando |
| **Portainer Stack** | Isabella | Listo | Configurado sin pull de Docker Hub (`pull_policy: build`) |
| **Modulo Taller & Ficha Tecnica** | Isabella / German | Completo en Frontend | 108 tests unitarios vitest en verde, build en 1.96s |
| **CI GitHub Actions** | Miguel / Andres / Isabella | Corregido | Fecha de despacho dinamica; 357 tests backend validados |
