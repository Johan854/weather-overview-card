# Weather Overview Card (FR)

Carte Home Assistant météo en français : conditions actuelles avec pictogramme animé, alerte, prévisions, mesures, risques (pluie, gel, neige) et informations. Style verre, thème clair/sombre automatique, éditeur visuel.

## Installation (HACS)
1. HACS → ⋮ → *Dépôts personnalisés* → `https://github.com/Johan854/weather-overview-card`, catégorie **Tableau de bord**.
2. Installer, puis recharger le navigateur.

## Exemple
```yaml
type: custom:weather-overview-card
weather_entity: weather.la_chapelle_themer
temperature_entity: sensor.la_chapelle_themer_temperature
condition_entity: sensor.la_chapelle_themer_original_condition
alert_entity: sensor.85_weather_alert
forecast_days: 5
metrics:
  - { entity: sensor.la_chapelle_themer_humidity, name: Humidité }
  - { entity: sensor.la_chapelle_themer_pressure, name: Pression }
  - { entity: sensor.la_chapelle_themer_uv, name: UV, icon: "mdi:sun-wireless" }
  - { entity: sensor.la_chapelle_themer_wind_speed, name: Vent }
  - { entity: sensor.la_chapelle_themer_wind_gust, name: Rafales }
  - { entity: sensor.la_chapelle_themer_cloud_cover, name: Nuages, icon: "mdi:weather-cloudy" }
  - { entity: sensor.la_chapelle_themer_daily_precipitation, name: Pluie }
risks:
  - { entity: sensor.la_chapelle_themer_rain_chance, name: Risque pluie, yellow: 40, red: 70 }
  - { entity: sensor.la_chapelle_themer_freeze_chance, name: Risque gel, yellow: 30, red: 60 }
  - { entity: sensor.la_chapelle_themer_snow_chance, name: Risque neige, yellow: 20, red: 50 }
infos:
  - { entity: sensor.la_chapelle_themer_next_rain, name: Prochaine pluie }
  - { entity: sensor.la_chapelle_themer_daily_original_condition, name: Prévision du jour }
  - { entity: sensor.la_chapelle_themer_original_condition, name: Conditions actuelles }
```

Options : `title`, `theme` (auto/light/dark), `show_forecast`, `forecast_days` (1 à 7).

## Apparence : nuance de couleur

Dans l'éditeur visuel, à côté du thème :

| Option | Valeurs |
|---|---|
| `nuance` | `theme` (par défaut), `braise`, `ocean`, `lagon`, `foret`, `lavande`, `framboise`, `ambre`, `ardoise`, `perso` |
| `nuance_perso` | Couleur au choix (sélecteur de couleur), utilisée avec `nuance: perso` |
| `intensite` | De `0` (neutre) à `2` (très coloré), `1` par défaut |

La nuance teinte le dégradé de fond (et la couleur d'accent quand la carte en a une). Les couleurs d'état (vert, orange, rouge…) ne changent pas.

**Une seule nuance pour toutes les cartes Johan854** : laisse `nuance: theme` et ajoute à ton thème Home Assistant :

```yaml
carte-nuance: "#2f8fd8"
```

Sans cette ligne, `nuance: theme` garde les couleurs d'origine de la carte.

## Historique des versions

- **1.1.0** : nuance de couleur au choix (8 nuances, couleur personnalisée, intensité, ou nuance commune via `carte-nuance` dans le thème).
