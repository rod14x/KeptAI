# Documentación de Desarrollo y Flujos Operativos — Isabel

> **Área:** Frontend, UX/UI, Arquitectura de Flujos de Confección y Despliegue Docker/Portainer  
> **Responsable:** Isabel (Isabelita)  
> **Fecha:** 19 de octubre de 2026  
> **Proyecto:** KeptAI / Corpotex (Hackathon Piura Innova 2026)  

---

## 1. Misión y Responsabilidad en el Proyecto
Como responsable de la experiencia de usuario, flujos de pantalla y despliegue del sistema KeptAI para la empresa de confecciones Corpotex, mi misión ha sido transformar el sistema desde una maqueta financiera hacia un sistema operativo integral donde:
1. **Cada dato tiene un único dueño:** La vendedora crea clientes, registra pedidos y llena la ficha técnica; el jefe de taller valida telas y avanza estaciones de planta; administración gestiona el crédito y conciliación; gerencia supervisa sin alterar datos.
2. **Cero cuellos de botella directivos:** Se eliminó la dependencia de que el dueño o jefe de la empresa deba aprobar manualmente la existencia de rollos de tela mediante un semáforo textil inteligente delegado al Jefe de Taller.
3. **Despliegue robusto y reproducible:** Contenedor Docker All-in-One integrable con Portainer y Supabase, con soporte tanto para modo demostración (`mock`) como modo de producción conectado a base de datos (`api` + Spring Boot + PostgreSQL).

---

## 2. Índice de Documentos en esta Carpeta

| Documento | Descripción |
| :--- | :--- |
| **[plan-implementacion-user-flows.md](./plan-implementacion-user-flows.md)** | Plan de implementación detallado de 5 fases (Fase 0 a 4), justificación de negocio, arquitectura de base de datos, backend Java y frontend React, y compuertas técnicas. |
| **[guia-despliegue-portainer-supabase.md](./guia-despliegue-portainer-supabase.md)** | Manual operativo para desplegar en Portainer: arquitectura Nginx + Spring Boot, explicación de por qué salía "datos demo", variables de compilación Vite y configuración de Supabase. |

---

## 3. Estado de los Componentes

| Capa | Estado | Verificación Técnica |
| :--- | :--- | :--- |
| **Migraciones Flyway** | Completadas (V15, V16, V17) | Scripts aditivos con RLS; script consolidado listo para SQL Editor. |
| **Backend Java (Spring Boot 4.1.1)** | Compilado y probado | `mvnw test-compile` -> `BUILD SUCCESS` (0 errores). |
| **Frontend SPA (React 19 + Vite)** | Compilado y empaquetado | `tsc -b && vite build` -> `✓ built in 934ms` (dist generado). |
| **Docker All-in-One** | Actualizado con build args | `compose.yaml` y `docker-compose.yml` listos para Portainer. |
