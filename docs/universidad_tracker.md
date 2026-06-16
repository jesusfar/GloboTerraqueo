# Universidad Tracker

Este proyecto puede actualizar `universidades.js` desde un Excel base o desde el
Excel enriquecido generado por `jesusfar/universidad_tracker`.

El globo sigue siendo una app estatica: no consulta APIs desde el navegador. Las
APIs se usan solo durante el proceso de actualizacion de datos.

## Que actualiza

- Ranking base conservado desde el Excel.
- Coordenadas reales para Google Maps.
- ROR ID y OpenAlex ID cuando el tracker los encuentra.
- Metricas OpenAlex cuando el Excel enriquecido las trae.
- `universidades.js`, que es el archivo consumido por `app.js`.

## Que no actualiza automaticamente

QS, THE y ARWU no cambian en tiempo real. El tracker puede conservar rankings
base y recolectar fuentes publicas cuando existan, pero el ranking oficial
depende de cada publicacion anual.

## Uso rapido

Instalar dependencias una vez:

```powershell
pip install -r tools/universidad_tracker/requirements.txt
```

Actualizar usando el tracker completo:

```powershell
.\tools\update_universidades.ps1
```

Si ya existe `uploads/universidades_tracker_actualizado.xlsx` y solo queres
regenerar `universidades.js`:

```powershell
.\tools\update_universidades.ps1 -SkipTracker
```

Forzar nuevas consultas a APIs:

```powershell
.\tools\update_universidades.ps1 -Force
```

## Variables opcionales

```powershell
$env:OPENALEX_API_KEY="TU_API_KEY"
$env:ROR_CLIENT_ID="TU_CLIENT_ID"
```

## Flujo interno

```text
uploads/top_200_universidades_QS_2026_con_ARG_LATAM_recomendadas.xlsx
  -> tools/universidad_tracker/universidad_ranking_tracker.py
  -> uploads/universidades_tracker_actualizado.xlsx
  -> tools/export_universidades_js.py
  -> universidades.js
```

