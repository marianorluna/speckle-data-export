# Prompting para aprender desarrollando

Guía humana (modo Ask). No sustituye `.cursor/rules/`; sirve para forzar mentoría antes o después de implementar.

## 1. Pre-Flight (frenar antes de picar código)

Cuando tengas un plan modular (por ejemplo: "Implementar el módulo de autenticación"), no dejes escribir código todavía. Abre el chat en modo Ask y usa este prompt:

```
ACTÚA COMO UN ARQUITECTO DE SOFTWARE PRINCIPAL EXPERTO EN EL STACK DE ESTE PROYECTO Y SEGURIDAD WEB. VOY A IMPLEMENTAR [MÓDULO O FEATURE]. ANTES DE ESCRIBIR UNA SOLA LÍNEA DE CÓDIGO, HAZ UNA LISTA DE:
  - QUÉ PATRONES DE DISEÑO AVANZADOS O HERRAMIENTAS MODERNAS (AÑO 2026) ELEVARÍAN ESTE CÓDIGO A NIVEL EMPRESARIAL.
  - QUÉ RIESGOS DE SEGURIDAD ESPECÍFICOS (INYECCIÓN, CONCURRENCIA DE DATOS, FRAUDE, EXPOSICIÓN DE SECRETOS) TIENE ESTE MÓDULO Y CÓMO PREVENIRLOS.
  - EXPLÍCAME LOS CONCEPTOS BREVEMENTE Y DIME CUÁL ES EL BENEFICIO REAL DE APLICARLOS AQUÍ.
```

La IA desplegará opciones con el porqué. Lees, aprendes y eliges qué aplicar.

## 2. Regla del 10% de innovación

Si propone 5 patrones y 3 librerías, no apliques todo a la vez. Elige **una** práctica avanzada por tarea:

```
ME HA GUSTADO EL CONCEPTO DE '[PRÁCTICA AVANZADA]' PARA RESOLVER [RIESGO O LIMITACIÓN CONCRETA]. VAMOS A IMPLEMENTAR SOLO ESO EN ESTA TAREA. EL RESTO DEL CÓDIGO HAZLO DE LA FORMA MÁS ESTÁNDAR Y SENCILLA POSIBLE.
```

Así incorporas conocimiento a un ritmo auditable en Git.

## 3. Reverse Engineering

Si una función tiene sintaxis o estructura que no dominas, en Ask selecciona el bloque y pregunta:

```
¿POR QUÉ HAS ESTRUCTURADO ESTA FUNCIÓN DE ESTA MANERA ESPECÍFICA? EXPLÍCAME EL PATRÓN DE DISEÑO QUE HAY DETRÁS PASO A PASO, COMO SI ESTUVIERAS DANDO UNA CLASE TÉCNICA.
```

Conviertes a la IA en tutor sobre su propio código mientras construyes la aplicación.
