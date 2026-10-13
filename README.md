# Opal Geo Tools

Country, state, and province lookup for Optimizely Opal — agent config, custom tool server, and CMS dropdown embed.

## Components

| Piece | Path |
| --- | --- |
| Agent JSON | `agents/geo_info_agent.json` |
| Tool server | `src/server.ts` |
| Dropdown UI | `public/index.html` |
| CMS workflow map | `workflows/cms-geo-dropdown.json` |

## Quick start

```bash
npm install
npm run dev
```

Server: `http://localhost:4000`

- Dropdown form: `http://localhost:4000/`
- Tool manifest: `GET /manifest`
- Health: `GET /health`

## Step 1 — Import the Opal agent

In **Optimizely Opal → Agents → Add Agent → Import JSON**, import `agents/geo_info_agent.json`.

Handle: `@geo-info`

## Step 2 — Register the tool connector

Point your Opal Tool connector at this service:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/manifest` | Tool discovery |
| `POST` | `/tools/get_country_details` | Body: `{ "query": "India" }` |
| `POST` | `/tools/get_states_by_country` | Body: `{ "countryCode": "IN" }` |

Example:

```bash
curl -s http://localhost:4000/tools/get_country_details -H "Content-Type: application/json" -d "{\"query\":\"India\"}"
curl -s http://localhost:4000/tools/get_states_by_country -H "Content-Type: application/json" -d "{\"countryCode\":\"IN\"}"
```

## Step 3 — Chat with the agent

In Opal Chat:

```text
@geo-info Give me all states for India and Australia
```

Expected flow: resolve each country via `get_country_details`, fetch states via `get_states_by_country`, render overview + Markdown table.

## Embed in a dropdown form or CMS workflow

### Live dropdown

Open `http://localhost:4000/` — cascading Country → State/Province selects backed by:

- `GET /api/countries`
- `GET /api/countries/:code/states`
- `POST /api/workflow/geo-lookup` — `{ "countryNameOrCode": "IN" }`

### iframe

```html
<iframe
  src="https://YOUR_HOST/"
  title="Country and state picker"
  style="width:100%;min-height:640px;border:0;border-radius:12px;"
></iframe>
```

### Optimizely workflow

See `workflows/cms-geo-dropdown.json` for a step map: load countries → on country change load states → on submit enrich via `/api/workflow/geo-lookup` → optional `@geo-info` summary.

## Production

```bash
npm run build
npm start
```

Set `PORT` if needed (default `4000`). Copy `.env.example` to `.env` for local overrides.
