# 🧪 MIA — Escenarios de prueba del chatbot

Este documento recopila **todos los tipos de mensaje** que un cliente podría enviar al chatbot MIA, junto con la **respuesta esperada** según la lógica implementada en el pipeline de conversación.

---

## Tabla de contenidos

- [1. Mensaje de bienvenida](#1-mensaje-de-bienvenida)
- [2. Consultas normales de productos (respuesta vía OpenAI)](#2-consultas-normales-de-productos-respuesta-vía-openai)
- [3. Red Flags — Emergencias (respuesta fija, sin OpenAI)](#3-red-flags--emergencias-respuesta-fija-sin-openai)
- [4. Límite médico — medical_limit (respuesta fija)](#4-límite-médico--medical_limit-respuesta-fija)
- [5. Límite de receta — rx_limit (respuesta fija)](#5-límite-de-receta--rx_limit-respuesta-fija)
- [6. Búsqueda de clínicas por código postal](#6-búsqueda-de-clínicas-por-código-postal)
- [7. Botones de acceso rápido (Quick Actions)](#7-botones-de-acceso-rápido-quick-actions)
- [8. Contexto de página de producto](#8-contexto-de-página-de-producto)
- [9. Mensajes genéricos / conversacionales](#9-mensajes-genéricos--conversacionales)
- [10. Casos límite y errores](#10-casos-límite-y-errores)
- [11. Prioridad del pipeline](#11-prioridad-del-pipeline)
- [12. Notas sobre normalización de texto](#12-notas-sobre-normalización-de-texto)

---

## 1. Mensaje de bienvenida

| # | Acción | Respuesta esperada | Tipo |
|---|--------|--------------------|------|
| 1.1 | El usuario abre el chat (carga la página) | `¡Hola! 👋 Soy **MIA**, tu asistente veterinario en la tienda. Puedo asesorarte sobre nutrición, antiparasitarios, higiene y cuidados generales para tu mascota. ❗ **No realizamos diagnósticos ni prescripciones.** ¿En qué puedo ayudarte hoy?` | `welcome` |

---

## 2. Consultas normales de productos (respuesta vía OpenAI)

Estas consultas **NO** contienen red flags, **NO** solicitan diagnóstico/dosis/receta, y **NO** contienen un código postal. El pipeline busca productos en el catálogo, información en vademécums, y llama a OpenAI GPT-4o.

| # | Mensaje del cliente | Comportamiento esperado | Respuesta esperada (resumen) |
|---|--------------------|-----------------------|------------------------------|
| 2.1 | `¿Qué antiparasitario me recomiendas para mi perro de 10 kg?` | Busca productos con "antiparasitario perro" → envía contexto a OpenAI | Respuesta de MIA con recomendación de productos del catálogo (spot-on, collar, pastilla), preguntas como "¿prefieres spot-on, collar o pastilla?" + tarjetas de producto |
| 2.2 | `Busco un champú para mi gato` | Busca "champú gato" en catálogo → OpenAI | Recomendación de champús específicos para gato del catálogo + tarjetas de producto |
| 2.3 | `¿Qué alimentación es mejor para mi gato adulto?` | Busca alimentos gato adulto → OpenAI | Recomendación de alimentación (pienso, húmedo) del catálogo con orientación general |
| 2.4 | `¿Qué suplementos recomiendas para un perro senior?` | Busca suplementos senior perro → OpenAI | Recomendación de suplementos articulares, vitamínicos, etc. del catálogo |
| 2.5 | `Necesito un collar antiparasitario para perro grande` | Busca collares antiparasitarios → OpenAI | Recomendación de collares antiparasitarios, comparación de opciones |
| 2.6 | `¿Tenéis pipetas para gato?` | Busca pipetas gato → OpenAI | Lista de pipetas spot-on disponibles para gato |
| 2.7 | `¿Cada cuánto debo desparasitar a mi perro?` | Busca antiparasitarios → OpenAI (con info de FAQs/vademécums) | Orientación general: cada 3–4 meses interno, externo según producto (mensual o larga duración) + "¿es para perro o gato? ¿peso aproximado?" |
| 2.8 | `¿Cada cuánto hay que bañar a un gato?` | Busca productos higiene → OpenAI | Orientación: en gatos solo cuando sea necesario. Recomendación de champú específico del catálogo |
| 2.9 | `Mi perro tiene el pelo seco, ¿qué le puedo poner?` | Busca productos pelo/dermis → OpenAI | Recomendación de champú hidratante o suplemento para piel del catálogo + aviso "si persiste, consulta veterinario" |
| 2.10 | `¿Qué diferencia hay entre pienso grain free y normal?` | OpenAI responde con info general + busca productos | Explicación breve de las diferencias + recomendación de productos del catálogo |
| 2.11 | `Busco algo para la limpieza dental de mi perro` | Busca productos dentales → OpenAI | Recomendación de snacks dentales, sprays o cepillos del catálogo |
| 2.12 | `¿Qué producto es bueno para las pulgas en cachorros?` | Busca antiparasitarios cachorros → OpenAI | Recomendación de productos aptos para cachorros (según edad mínima indicada) |
| 2.13 | `¿Tenéis comida húmeda para perros?` | Busca comida húmeda → OpenAI | Lista de productos de alimentación húmeda disponibles |
| 2.14 | `Quiero algo natural para las garrapatas` | Busca antiparasitarios natural garrapatas → OpenAI | Recomendación de opciones naturales si existen en catálogo, o las más adecuadas |
| 2.15 | `¿Me recomiendas un arnés para pasear a mi gato?` | Busca arnés gato → OpenAI | Recomendación de accesorios si hay en catálogo, o indicación de que no está disponible |

---

## 3. Red Flags — Emergencias (respuesta fija, sin OpenAI)

Cuando se detecta un red flag, **NO se llama a OpenAI**. Se devuelve la plantilla de emergencia `emergency_warning`. La detección es por subcadena sobre texto normalizado (sin acentos, minúsculas).

### 3.1 Red flags de tipo `keyword` (una sola palabra/frase basta)

| # | Mensaje del cliente | Patrón detectado | Severidad | Categoría |
|---|--------------------|-----------------:|-----------|-----------|
| 3.1.1 | `Mi perro no respira` | `no respira` | emergency | respiracion |
| 3.1.2 | `Tiene dificultad para respirar desde esta mañana` | `dificultad para respirar` | emergency | respiracion |
| 3.1.3 | `Mi gato jadea mucho y está raro` | `jadea mucho` | emergency | respiracion |
| 3.1.4 | `¡Se ahoga! ¡Ayuda!` | `se ahoga` | emergency | respiracion |
| 3.1.5 | `Se está asfixiando con algo` | `se asfixia` | emergency | respiracion |
| 3.1.6 | `Mi perro está inconsciente` | `inconsciente` | emergency | consciencia |
| 3.1.7 | `Ha tenido un desmayo` | `desmayo` | emergency | consciencia |
| 3.1.8 | `Mi gato no reacciona a nada` | `no reacciona` | emergency | consciencia |
| 3.1.9 | `Se ha caído y no se mueve` | `se ha caido y no se mueve` | emergency | consciencia |
| 3.1.10 | `Tiene convulsiones muy fuertes` | `convulsiones` | emergency | consciencia |
| 3.1.11 | `Ha tenido una convulsión` | `convulsion` | emergency | consciencia |
| 3.1.12 | `Le ha dado un ataque` | `ataque` | emergency | consciencia |
| 3.1.13 | `Tiene temblores fuertes` | `temblores fuertes` | emergency | consciencia |
| 3.1.14 | `Presenta temblores severos` | `temblores severos` | emergency | consciencia |
| 3.1.15 | `Tiene una hemorragia en la pata` | `hemorragia` | emergency | sangrado |
| 3.1.16 | `Mi perro vomita sangre` | `vomita sangre` | emergency | sangrado |
| 3.1.17 | `Las heces tienen sangre` | `heces con sangre` | emergency | sangrado |
| 3.1.18 | `Orina con sangre desde ayer` | `orina con sangre` | emergency | sangrado |
| 3.1.19 | `Sangra mucho de la boca` | `sangra mucho` | emergency | sangrado |
| 3.1.20 | `Tiene las encías blancas` | `encias blancas` | emergency | shock |
| 3.1.21 | `Está muy pálido y débil` | `muy palido` | emergency | shock |
| 3.1.22 | `Mi gato está frío al tacto` | `esta frio` | emergency | shock |
| 3.1.23 | `Creo que está en shock` | `en shock` | emergency | shock |
| 3.1.24 | `Creo que ha comido veneno` | `veneno` | emergency | envenenamiento |
| 3.1.25 | `Mi perro ha sido envenenado` | `envenenado` | emergency | envenenamiento |
| 3.1.26 | `Sospecho intoxicación` | `intoxicacion` | emergency | envenenamiento |
| 3.1.27 | `Mi perro comió chocolate` | `comio chocolate` | emergency | envenenamiento |
| 3.1.28 | `Ha comido chocolate y está temblando` | `ha comido chocolate` | emergency | envenenamiento |
| 3.1.29 | `Se ha comido un raticida` | `raticida` | emergency | envenenamiento |
| 3.1.30 | `Ha comido veneno para ratas` | `veneno para ratas` | emergency | envenenamiento |
| 3.1.31 | `Ha lamido anticongelante` | `anticongelante` | emergency | envenenamiento |
| 3.1.32 | `Ha bebido lejía` | `lejia` | emergency | envenenamiento |
| 3.1.33 | `Le di un medicamento humano por error` | `medicamento humano` | emergency | envenenamiento |
| 3.1.34 | `Mi perro comió uvas` | `uvas` | urgent | envenenamiento |
| 3.1.35 | `Ha comido pasas del suelo` | `pasas` | urgent | envenenamiento |
| 3.1.36 | `¿Es tóxico el xilitol para perros?` | `xilitol` | emergency | envenenamiento |
| 3.1.37 | `Mi gato ha mordido un lirio` | `lirio` | emergency | envenenamiento |
| 3.1.38 | `Le di paracetamol a mi gato` | `paracetamol` | emergency | envenenamiento |
| 3.1.39 | `A mi perro lo han atropellado` | `atropellado` | emergency | trauma |
| 3.1.40 | `Le ha atropellado un coche` | `le ha atropellado` | emergency | trauma |
| 3.1.41 | `Ha tenido una caída grave desde el balcón` | `caida grave` | emergency | trauma |
| 3.1.42 | `Creo que tiene una fractura` | `fractura` | emergency | trauma |
| 3.1.43 | `Ha recibido un golpe fuerte en la cabeza` | `golpe fuerte` | emergency | trauma |
| 3.1.44 | `Tiene una mordedura grave de otro perro` | `mordedura grave` | emergency | trauma |
| 3.1.45 | `Tiene un dolor muy fuerte y no para de gritar` | `dolor muy fuerte` | emergency | dolor |
| 3.1.46 | `Llora de dolor cuando lo toco` | `llora de dolor` | emergency | dolor |
| 3.1.47 | `Grita de dolor al caminar` | `grita de dolor` | emergency | dolor |
| 3.1.48 | `Tiene el abdomen hinchado y duro` | `abdomen hinchado` | emergency | abdomen |
| 3.1.49 | `Se le ha hinchado la barriga, la barriga hinchada y dura` | `barriga hinchada` | emergency | abdomen |
| 3.1.50 | `Mi gato no puede orinar` | `no puede orinar` | emergency | abdomen |
| 3.1.51 | `Intenta orinar y no puede desde ayer` | `intenta orinar y no puede` | emergency | abdomen |
| 3.1.52 | `El veterinario dijo que tiene bloqueo urinario` | `bloqueo urinario` | emergency | abdomen |
| 3.1.53 | `Tengo un cachorro muy pequeño y está aletargado` | `cachorro muy pequeno y aletargado` | emergency | vulnerables |
| 3.1.54 | `Encontré un gatito recién nacido abandonado` | `gatito recien nacido` | emergency | vulnerables |
| 3.1.55 | `Mi perro es muy viejo y no come desde hace días` | `muy viejo y no come` | urgent | vulnerables |

**Respuesta esperada para TODOS los casos de red flag:**

```
🚨 **Atención urgente**

Según lo que describes, esto podría ser una **emergencia veterinaria**. Este chat no puede atender emergencias ni realizar valoraciones clínicas.

**Te recomiendo acudir a tu veterinario o a un servicio de urgencias veterinarias de forma inmediata.**

Podemos recomendarte los mejores veterinarios de tu zona. Solo indícanos tu código postal.
```

- `responseType`: `emergency_warning`
- `awaitingPostalCode`: `true`
- **NO se llama a OpenAI**
- **NO se recomiendan productos**

### 3.2 Red flags de tipo `combined` (TODAS las keywords deben estar presentes)

| # | Mensaje del cliente | Patrón detectado | Severidad |
|---|--------------------|-----------------:|-----------|
| 3.2.1 | `Mi perro vomita y hay sangre en el vómito` | `vomita` + `sangre` | emergency |
| 3.2.2 | `No come, no bebe y está aletargado todo el día` | `no come` + `no bebe` + `aletargado` | emergency |
| 3.2.3 | `Tiene diarrea acuosa y está con mucho letargo` | `diarrea acuosa` + `letargo` | emergency |
| 3.2.4 | `Diarrea acuosa, está aletargado y no se mueve` | `diarrea acuosa` + `aletargado` | emergency |
| 3.2.5 | `Lleva todo el día que vomita sin parar` | `vomita` + `sin parar` | emergency |
| 3.2.6 | `Tiene fiebre muy alta y no quiere comer` | `fiebre` + `muy alta` | urgent |
| 3.2.7 | `Le hemos medido la temperatura y tiene fiebre de 40` | `fiebre` + `40` | urgent |
| 3.2.8 | `Tiene fiebre de 41 grados` | `fiebre` + `41` | emergency |

**Respuesta esperada:** Misma plantilla `emergency_warning` que en 3.1.

### 3.3 Red flags combinados que NO se deben disparar (falsos positivos a evitar)

| # | Mensaje del cliente | ¿Se dispara? | Motivo |
|---|--------------------|---------:|--------|
| 3.3.1 | `Mi perro no come bien últimamente` | ❌ NO | Falta `no bebe` y `aletargado` para la regla combinada |
| 3.3.2 | `Tiene diarrea desde ayer` | ❌ NO | Falta `letargo` / `aletargado` para las reglas combinadas, y `diarrea` sola no es keyword |
| 3.3.3 | `Vomitó una vez esta mañana` | ❌ NO | `vomita` sola sin `sangre` ni `sin parar` no dispara nada (nota: `vomitó` se normaliza a `vomito`, no coincide con `vomita`) |

> ⚠️ **Nota importante (caso 3.3.3):** El keyword `vomita` NO coincide con `vomitó` porque al normalizar se convierte en `vomito` (sin tilde). Solo dispara si el mensaje normalizado contiene la subcadena exacta `vomita`. Esto podría causar que algunos mensajes con formas conjugadas no se detecten.

---

## 4. Límite médico — `medical_limit` (respuesta fija)

Se activa cuando el mensaje normalizado contiene alguno de estos patrones (subcadena):
`que dosis`, `cuanta dosis`, `dosis recomendada`, `que le doy`, `que medicamento`, `que le puedo dar`, `diagnostico`, `diagnosticar`, `que enfermedad tiene`, `que le pasa`, `que tiene mi`, `esta enfermo`, `recetame`, `prescribeme`, `necesito receta`, `sustituir medicamento`, `cambiar medicamento`, `alternativa a`, `interpretar analisis`, `interpretar resultados`

| # | Mensaje del cliente | Patrón detectado |
|---|--------------------|-----------------:|
| 4.1 | `¿Qué dosis de antiparasitario le doy a mi perro de 25 kg?` | `que dosis` |
| 4.2 | `¿Cuánta dosis le toca?` | `cuanta dosis` |
| 4.3 | `¿Cuál es la dosis recomendada de este producto?` | `dosis recomendada` |
| 4.4 | `¿Qué le doy para la tos?` | `que le doy` |
| 4.5 | `¿Qué medicamento me recomiendas para la infección?` | `que medicamento` |
| 4.6 | `¿Qué le puedo dar para el dolor?` | `que le puedo dar` |
| 4.7 | `¿Puedes darme un diagnóstico?` | `diagnostico` |
| 4.8 | `¿Puedes diagnosticar lo que tiene?` | `diagnosticar` |
| 4.9 | `¿Qué enfermedad tiene mi perro?` | `que enfermedad tiene` |
| 4.10 | `¿Qué le pasa a mi gato? Está raro` | `que le pasa` |
| 4.11 | `¿Qué tiene mi perro? Está decaído` | `que tiene mi` |
| 4.12 | `Creo que está enfermo, ¿qué hago?` | `esta enfermo` |
| 4.13 | `Recétame algo para la infección de oído` | `recetame` |
| 4.14 | `Prescríbeme un antibiótico` | `prescribeme` |
| 4.15 | `Necesito receta para este medicamento` | `necesito receta` |
| 4.16 | `¿Puedo sustituir medicamento X por Y?` | `sustituir medicamento` |
| 4.17 | `Quiero cambiar medicamento, ¿puedo?` | `cambiar medicamento` |
| 4.18 | `¿Hay alternativa a este antiinflamatorio?` | `alternativa a` |
| 4.19 | `¿Puedes interpretar estos análisis de sangre?` | `interpretar analisis` |
| 4.20 | `¿Me ayudas a interpretar los resultados de la ecografía?` | `interpretar resultados` |

**Respuesta esperada para TODOS los casos de `medical_limit`:**

```
Entiendo tu preocupación. No puedo diagnosticar, prescribir ni ajustar dosis/tratamientos.
Lo mejor es que tu veterinario lo valore.

Si me dices el producto que estás valorando (o el peso/especie), puedo orientarte sobre las diferencias entre opciones y su uso general según la ficha.

También podemos recomendarte los mejores veterinarios de tu zona. Solo indícanos tu código postal.
```

- `responseType`: `medical_limit`
- `awaitingPostalCode`: `true`
- **NO se llama a OpenAI**
- **NO se recomiendan productos**

---

## 5. Límite de receta — `rx_limit` (respuesta fija)

Se activa cuando el mensaje normalizado contiene alguno de estos patrones:
`receta`, `prescripcion`, `medicamento con receta`, `necesita receta`, `requiere receta`, `antibiotico`, `corticoide`, `antiinflamatorio con receta`

> ⚠️ **Nota:** El patrón `receta` es muy amplio. El patrón `necesito receta` se detecta PRIMERO como `medical_limit` (paso 5 del pipeline), por lo que nunca llega al check de `rx_limit` (paso 6). Pero patrones como `¿necesita receta este producto?` sí caen en `rx_limit` porque no contienen `necesito receta`.

| # | Mensaje del cliente | Patrón detectado |
|---|--------------------|-----------------:|
| 5.1 | `¿Este producto necesita receta?` | `receta` |
| 5.2 | `¿Requiere receta veterinaria?` | `requiere receta` |
| 5.3 | `¿Necesita receta el antiparasitario X?` | `necesita receta` |
| 5.4 | `¿Es con prescripción?` | `prescripcion` |
| 5.5 | `Es un medicamento con receta, ¿puedo comprarlo?` | `medicamento con receta` |
| 5.6 | `¿Tenéis algún antibiótico para infección de oído?` | `antibiotico` |
| 5.7 | `Busco un corticoide para mi perro` | `corticoide` |
| 5.8 | `¿Vendéis antiinflamatorio con receta?` | `antiinflamatorio con receta` |

**Respuesta esperada para TODOS los casos de `rx_limit`:**

```
Para medicamentos que requieren receta veterinaria, la indicación y la dosis deben venir de un veterinario.

Podemos recomendarte los mejores veterinarios de tu zona. Solo indícanos tu código postal.
```

- `responseType`: `rx_limit`
- `awaitingPostalCode`: `true`
- **NO se llama a OpenAI**
- **NO se recomiendan productos**

---

## 6. Búsqueda de clínicas por código postal

Se activa cuando el mensaje contiene un **número de 5 dígitos** cuyo prefijo provincial (2 primeros dígitos) está entre 01 y 52 (códigos postales válidos de España). Esta comprobación ocurre **ANTES** que los red flags en el pipeline.

| # | Mensaje del cliente | CP detectado | Respuesta esperada |
|---|--------------------|---------:|---------------------|
| 6.1 | `28001` | `28001` | Tarjetas de clínicas en la zona CP 28001 (Madrid), o clínicas en la provincia 28 si no hay coincidencia exacta |
| 6.2 | `Mi código postal es 46010` | `46010` | Clínicas en CP 46010 (Valencia) |
| 6.3 | `Estoy en el 08034` | `08034` | Clínicas en CP 08034 (Barcelona) |
| 6.4 | `Vivo en Sevilla, CP 41001` | `41001` | Clínicas en CP 41001 (Sevilla) |
| 6.5 | `¿Hay veterinarios cerca del 01005?` | `01005` | Clínicas en CP 01005 (Álava) |
| 6.6 | `52001` | `52001` | Clínicas en CP 52001 (Melilla) — límite superior válido |

### Caso: No hay clínicas

Si no se encuentran clínicas para el CP ni para el prefijo provincial:

```
Lo sentimos, no tenemos clínicas colaboradoras registradas en tu zona actualmente. Te recomendamos buscar "urgencias veterinarias" junto con tu localidad en Google.
```

### Casos que NO disparan la búsqueda de clínicas

| # | Mensaje del cliente | Motivo |
|---|--------------------| ------|
| 6.7 | `Mi perro pesa 53000 gramos` | `53000` → prefijo 53 fuera del rango 01–52 |
| 6.8 | `Tiene 12 años y pesa 80 kg` | No contiene un número de exactamente 5 dígitos (delimitado por word boundary) |
| 6.9 | `Número de pedido: 123456` | `12345` → No se extrae porque el regex busca `\b\d{5}\b` y `123456` tiene 6 dígitos |
| 6.10 | `Le di 3 pastillas` | No contiene un número de 5 dígitos |

> ⚠️ **Caso problemático potencial (6.11):** Un mensaje como `Quiero desparasitar, peso 28001 gramos` extraerá `28001` como código postal y **no llegará a OpenAI**, devolviendo clínicas en vez de recomendar productos. El pipeline prioriza el CP antes que cualquier otro paso.

---

## 7. Botones de acceso rápido (Quick Actions)

Estos son los mensajes que se envían al hacer clic en los botones de la homepage:

| # | Botón | Mensaje enviado | Comportamiento esperado |
|---|-------|-----------------|------------------------|
| 7.1 | 🛡️ Antiparasitarios | `¿Qué antiparasitario me recomiendas para mi perro?` | Respuesta normal vía OpenAI con productos antiparasitarios del catálogo |
| 7.2 | 🍽️ Alimentación | `¿Qué alimentación es mejor para mi gato adulto?` | Respuesta normal vía OpenAI con productos de alimentación |
| 7.3 | 🧴 Higiene | `¿Qué productos de higiene necesito para mi mascota?` | Respuesta normal vía OpenAI con productos de higiene |
| 7.4 | 💊 Suplementos | `¿Qué suplementos recomiendas para un perro senior?` | Respuesta normal vía OpenAI con suplementos del catálogo |

---

## 8. Contexto de página de producto

Cuando el usuario está en una **página de producto** de PrestaShop, el widget flotante envía automáticamente el contexto del producto (`productContext`). Esto modifica la respuesta de OpenAI.

| # | Mensaje del cliente | Contexto del producto | Respuesta esperada |
|---|--------------------|--------------------|---------------------|
| 8.1 | `¿Este producto es bueno?` | `{ name: "Collar Seresto", price: 35, category: "Antiparasitarios" }` | Respuesta contextualizada sobre el Collar Seresto (pros, uso, duración) |
| 8.2 | `¿Sirve para gatos?` | `{ name: "Pipeta Frontline", species: "Perros" }` | Explicación de que esa pipeta es para perros + recomendación de la versión para gatos si existe |
| 8.3 | `¿Cuánto dura?` | `{ name: "Collar Scalibor", category: "Antiparasitarios" }` | Información sobre la duración del collar según su ficha |
| 8.4 | `¿Hay algo más barato?` | `{ name: "Pienso Royal Canin", price: 55 }` | Búsqueda de alternativas más económicas en el catálogo |

---

## 9. Mensajes genéricos / conversacionales

Estos mensajes no contienen ni red flags, ni solicitudes médicas, ni CP. Van directamente a OpenAI.

| # | Mensaje del cliente | Respuesta esperada |
|---|--------------------|--------------------|
| 9.1 | `Hola` | Saludo amable + "¿En qué puedo ayudarte?" |
| 9.2 | `Gracias` | "De nada, si necesitas algo más aquí estoy" |
| 9.3 | `¿Quién eres?` | Presentación: "Soy MIA, tu asistente veterinario de MundoMascotix..." |
| 9.4 | `¿Hacéis envíos a Canarias?` | Respuesta de OpenAI basada en el system prompt (MIA no tiene esa información, probablemente indicará consultar la web de la tienda) |
| 9.5 | `¿Cuál es vuestro horario?` | Similar al anterior: MIA no dispone de esa información, redirigirá a la web |
| 9.6 | `¿Puedo devolver un producto?` | MIA no gestiona devoluciones; redirigirá al servicio de atención al cliente |
| 9.7 | `¿Cuánto cuesta el envío?` | MIA no tiene esa información; redirigirá a la web de la tienda |
| 9.8 | `Adiós` | Despedida amable |

---

## 10. Casos límite y errores

| # | Escenario | Comportamiento esperado |
|---|-----------|------------------------|
| 10.1 | Mensaje vacío (`""`) | Error 400: `El mensaje no puede estar vacío` |
| 10.2 | Mensaje de más de 2000 caracteres | Error 400: `El mensaje es demasiado largo (máximo 2000 caracteres)` |
| 10.3 | Sin `sessionId` | Error 400: `sessionId es obligatorio` |
| 10.4 | OpenAI devuelve error 429 (rate limit) | `Disculpa, estamos recibiendo muchas consultas en este momento. Por favor, inténtalo de nuevo en unos segundos.` |
| 10.5 | OpenAI devuelve error genérico | `Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, inténtalo de nuevo.` |
| 10.6 | Error del servidor (500) | `Error al procesar tu mensaje. Por favor, inténtalo de nuevo.` |
| 10.7 | Error de red en el frontend | `Disculpa, no he podido procesar tu mensaje. Comprueba tu conexión e inténtalo de nuevo.` |
| 10.8 | Fallo en búsqueda de productos | Se continúa sin contexto de catálogo (log warning) — la respuesta de OpenAI no incluirá tarjetas de producto |
| 10.9 | Fallo en búsqueda de vademécums | Se continúa sin información técnica (log warning) — la respuesta de OpenAI no incluirá datos de vademécum |
| 10.10 | DB de red flags no disponible | Se usan patrones fallback hardcodeados en `redFlagService.js` |

---

## 11. Prioridad del pipeline

El pipeline procesa cada mensaje en este **orden estricto**. El primer paso que coincida detiene la ejecución:

```
1. ¿Contiene un código postal (5 dígitos, prefijo 01–52)?
   → SÍ: Búsqueda de clínicas (responseType: clinic_recommendation)
   → NO: Continuar

2. ¿Contiene un red flag (keyword o combined)?
   → SÍ: Respuesta de emergencia fija (responseType: emergency_warning)
   → NO: Continuar

3. ¿Contiene un patrón médico (MEDICAL_REQUEST_PATTERNS)?
   → SÍ: Respuesta de límite médico (responseType: medical_limit)
   → NO: Continuar

4. ¿Contiene un patrón de receta (RX_PATTERNS)?
   → SÍ: Respuesta de límite Rx (responseType: rx_limit)
   → NO: Continuar

5. Flujo normal:
   a. Buscar productos en catálogo
   b. Buscar información en vademécums
   c. Llamar a OpenAI con todo el contexto
   → responseType: normal
```

### Implicaciones de la prioridad

| # | Mensaje | ¿Qué paso gana? | Explicación |
|---|---------|----------------|-------------|
| 11.1 | `Mi perro está envenenado, estoy en el 28001` | **Paso 1 (CP)** | El CP `28001` se detecta primero; se devuelven clínicas, NO la alerta de emergencia |
| 11.2 | `Mi perro tiene convulsiones` | **Paso 2 (Red flag)** | `convulsiones` es un red flag keyword |
| 11.3 | `¿Qué le doy para la tos?` | **Paso 3 (Medical)** | `que le doy` coincide con MEDICAL_REQUEST_PATTERNS |
| 11.4 | `¿Este producto necesita receta?` | **Paso 4 (Rx)** | `receta` coincide con RX_PATTERNS |
| 11.5 | `¿Qué champú me recomiendas?` | **Paso 5 (Normal)** | No coincide con ningún filtro previo |
| 11.6 | `Necesito receta para mi perro enfermo` | **Paso 3 (Medical)** | `necesito receta` coincide con MEDICAL_REQUEST_PATTERNS antes de llegar al check de RX_PATTERNS |

> ⚠️ **Caso crítico (11.1):** Si un usuario envía un mensaje de emergencia **junto con** su código postal, el pipeline devolverá clínicas en lugar de la alerta de emergencia. Esto podría ser beneficioso (ya se le envía ayuda) o podría omitir la advertencia de urgencia.

---

## 12. Notas sobre normalización de texto

El sistema normaliza todos los mensajes antes de buscar patrones:

1. **Minúsculas:** `Mi Perro` → `mi perro`
2. **Sin acentos:** `convulsión` → `convulsion`, `diagnóstico` → `diagnostico`
3. **Puntuación reemplazada por espacios:** `¡Ayuda!` → `ayuda`
4. **Espacios múltiples colapsados:** `mi   perro` → `mi perro`

### Ejemplos de normalización

| Mensaje original | Mensaje normalizado |
|-----------------|---------------------|
| `¿Qué DOSIS le doy?` | `que dosis le doy` |
| `¡¡¡CONVULSIONES!!!` | `convulsiones` |
| `Mi gato está ENVENENADO...` | `mi gato esta envenenado` |
| `Le di paracetamol 😰` | `le di paracetamol` |
| `DIAGNÓSTICO urgente` | `diagnostico urgente` |
| `¿Necesita receta?` | `necesita receta` |

---

## Resumen de tipos de respuesta

| Tipo de respuesta | ¿Llama a OpenAI? | ¿Recomienda productos? | ¿Solicita CP? | Cuándo se activa |
|-------------------|:-:|:-:|:-:|-----------------|
| `welcome` | ❌ | ❌ | ❌ | Al cargar el chat |
| `emergency_warning` | ❌ | ❌ | ✅ | Red flag detectado |
| `medical_limit` | ❌ | ❌ | ✅ | Solicita diagnóstico/dosis/tratamiento |
| `rx_limit` | ❌ | ❌ | ✅ | Pregunta sobre medicamentos con receta |
| `clinic_recommendation` | ❌ | ❌ | — | Envía un código postal |
| `normal` | ✅ | ✅ | ❌ | Consulta general sobre productos |
| `error` (frontend) | — | ❌ | ❌ | Fallo de red o del servidor |
