# Geo Info Agent — Step-by-Step Guide

This guide walks through building, deploying, and using an Optimizely Opal agent that retrieves **country**, **state**, and **province** data.

You need three components:

1. **Agent Specification** — Opal JSON that declares inputs, prompt instructions, and tool bindings  
2. **Custom Tools** — Backend API that queries geographic data  
3. **Workflow / Prompt Usage** — How users or CMS processes call the agent (including dropdown embed)

---

## Prerequisites

- Node.js 18+ installed  
- Access to Optimizely Opal (Agents + Tool connectors)  
- This repository: `opal-geo-tools`

```bash
cd opal-geo-tools
npm install
```

---

## Step 1: Opal Agent JSON Configuration (`@geo-info`)

The agent definition lives at:

```text
agents/geo_info_agent.json
```

### What it contains

| Field | Purpose |
| --- | --- |
| `id` / `handle` | Agent identity (`geo_info_agent` / `geo-info`) |
| `input_variables` | `countryNameOrCode` (required), `includeDetails` (optional) |
| `prompt_template` | Instructs the agent to call tools and format Markdown output |
| `tools` | Binds `get_country_details` and `get_states_by_country` |
| `output_type` | `Markdown` |

### Import into Opal

1. Open **Optimizely Opal → Agents → Add Agent**  
2. Choose **Import JSON**  
3. Select (or paste) `agents/geo_info_agent.json`  
4. Save and enable the agent  

You can now mention it in chat as:

```text
@geo-info
```

### Agent behavior (prompt summary)

1. Call `get_country_details` with the user’s country name or code  
2. Use the resolved ISO-2 code to call `get_states_by_country`  
3. Format an **Overview** plus a **States/Provinces** table  
4. If the country is invalid or ambiguous, return closest matches — do not invent data  

---

## Step 2: Implement and Run the Custom Tools

The tool server is a TypeScript Express app using the `country-state-city` dataset (no external API key required for the default path).

### Key files

| File | Role |
| --- | --- |
| `src/server.ts` | HTTP routes, Opal manifest, CMS APIs |
| `src/geo.ts` | Country lookup, fuzzy suggestions, state list + type hints |
| `public/index.html` | Cascading country → state dropdown UI |

### Start the server (development)

```bash
npm run dev
```

Default URL: `http://localhost:4000`

### Production build

```bash
npm run build
npm start
```

Optional: copy `.env.example` to `.env` and set `PORT` if you need a different port.

### Register as an Opal Tool connector

Point your Opal Tool connector at this service. Discovery and execution endpoints:

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| `GET` | `/manifest` | — | Tool discovery for Opal |
| `POST` | `/tools/get_country_details` | `{ "query": "India" }` | Country metadata |
| `POST` | `/tools/get_states_by_country` | `{ "countryCode": "IN" }` | States / provinces |

### Manual API checks

**Health**

```bash
# PowerShell
Invoke-RestMethod http://localhost:4000/health
```

**Country details**

```powershell
Invoke-RestMethod -Uri http://localhost:4000/tools/get_country_details `
  -Method POST -ContentType "application/json" `
  -Body '{"query":"India"}'
```

**States by country**

```powershell
Invoke-RestMethod -Uri http://localhost:4000/tools/get_states_by_country `
  -Method POST -ContentType "application/json" `
  -Body '{"countryCode":"IN"}'
```

**Ambiguous query (suggestions)**

```powershell
Invoke-RestMethod -Uri http://localhost:4000/tools/get_country_details `
  -Method POST -ContentType "application/json" `
  -Body '{"query":"United"}'
```

Expected: HTTP 404 with suggestions such as United States, United Kingdom, United Arab Emirates.

### Tool response shapes

**`get_country_details` (success)**

```json
{
  "name": "India",
  "iso2": "IN",
  "currency": "INR",
  "phonecode": "91",
  "flag": "🇮🇳",
  "latitude": "20.00000000",
  "longitude": "77.00000000"
}
```

**`get_states_by_country` (success)**

```json
{
  "countryCode": "IN",
  "totalStates": 36,
  "states": [
    { "name": "Maharashtra", "stateCode": "MH", "type": "State" }
  ]
}
```

---

## Step 3: Test and Chat with the Agent

Once the tool server is reachable and the agent is enabled in Opal:

### In Opal Chat

```text
@geo-info Give me all states for India and Australia
```

### Expected agent behavior

1. Detects queries for **India (IN)** and **Australia (AU)**  
2. Calls `get_country_details` for each country  
3. Calls `get_states_by_country` with `IN` and `AU`  
4. Renders:
   - Overview (flag, ISO codes, currency, totals)  
   - Markdown tables of state/province names, codes, and types  

Approximate counts from this dataset:

| Country | ISO-2 | Divisions (approx.) |
| --- | --- | --- |
| India | `IN` | 36 (states + union territories) |
| Australia | `AU` | 8 (states + territories) |

### Other useful prompts

```text
@geo-info countryNameOrCode=CA includeDetails=true
@geo-info What are the provinces of Canada?
@geo-info Look up "United" — if ambiguous, list matches
```

---

## Step 4: Embed in a Dropdown Form or CMS Workflow

You asked to embed this into a form/CMS flow. That is already wired in this repo.

### Option A — Live dropdown UI

1. Start the server (`npm run dev`)  
2. Open `http://localhost:4000/`  
3. Select a **Country**, then a **State / Province**  
4. Click **Look up details** for a summary table  
5. Use **Copy @geo-info prompt** to paste into Opal Chat  

### Option B — iframe in CMS

```html
<iframe
  src="https://YOUR_HOST/"
  title="Country and state picker"
  style="width:100%;min-height:640px;border:0;border-radius:12px;"
></iframe>
```

Replace `YOUR_HOST` with your deployed tool server URL.

### Option C — Optimizely / CMS workflow HTTP steps

Workflow map file:

```text
workflows/cms-geo-dropdown.json
```

Recommended flow:

| Step | Method | URL | When |
| --- | --- | --- | --- |
| Load countries | `GET` | `{{GEO_TOOLS_BASE_URL}}/api/countries` | Form load |
| Load states | `GET` | `{{GEO_TOOLS_BASE_URL}}/api/countries/{{form.country}}/states` | Country change |
| Enrich selection | `POST` | `{{GEO_TOOLS_BASE_URL}}/api/workflow/geo-lookup` | Form submit |
| Optional summary | Opal agent `@geo-info` | — | Manual or automation |

**One-shot lookup example**

```powershell
Invoke-RestMethod -Uri http://localhost:4000/api/workflow/geo-lookup `
  -Method POST -ContentType "application/json" `
  -Body '{"countryNameOrCode":"IN","includeDetails":true}'
```

**Dropdown data endpoints**

```text
GET  /api/countries
GET  /api/countries/:code/states
POST /api/workflow/geo-lookup
```

Set `GEO_TOOLS_BASE_URL` in your CMS/workflow environment to the public base URL of this service.

---

## Step 5: Project Layout Reference

```text
opal-geo-tools/
├── agents/
│   └── geo_info_agent.json      # Import into Opal
├── src/
│   ├── server.ts                # Express + Opal + CMS routes
│   └── geo.ts                   # Lookup logic
├── public/
│   └── index.html               # Cascading dropdown UI
├── workflows/
│   └── cms-geo-dropdown.json    # CMS / workflow step map
├── STEPS.md                     # This guide
├── README.md                    # Quick reference
├── package.json
└── .env.example
```

---

## Step 6: Checklist Before Go-Live

- [ ] `npm run dev` (or `npm start`) succeeds and `/health` returns `ok`  
- [ ] `GET /manifest` lists both tools  
- [ ] Opal Tool connector points at the deployed base URL  
- [ ] Agent JSON imported; handle `@geo-info` works in chat  
- [ ] Test India + Australia chat prompt end-to-end  
- [ ] If using CMS: countries/states dropdowns load; submit hits `/api/workflow/geo-lookup`  
- [ ] Production host uses HTTPS and is reachable from Opal  

---

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Agent does not call tools | Tool names in agent JSON must match manifest (`get_country_details`, `get_states_by_country`) |
| 404 on country | Use full name or ISO-2; check `suggestions` in the response |
| Empty state list | Some territories have no subdivisions in the dataset |
| Dropdown blank | Confirm server is running and `/api/countries` returns JSON |
| Opal cannot reach tools | Deploy publicly (or tunnel) and update the connector URL |

---

## Quick command cheat sheet

```bash
npm install
npm run dev          # http://localhost:4000
npm run build
npm start
```

Opal Chat:

```text
@geo-info Give me all states for India and Australia
```
