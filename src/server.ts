import express, { Request, Response } from "express";
import path from "path";
import {
  findCountry,
  getStatesByCountryCode,
  listCountriesForDropdown,
} from "./geo";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

/** Opal tool discovery manifest */
app.get("/manifest", (_req: Request, res: Response) => {
  res.json({
    name: "opal-geo-tools",
    version: "1.0.0",
    tools: [
      {
        name: "get_country_details",
        description:
          "Looks up metadata (ISO-2, capital/currency proxies, phone code, flag) by country name or code. Returns closest matches when ambiguous.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Country name or ISO code (e.g., 'India', 'IN', 'United States', 'US')",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_states_by_country",
        description:
          "Returns the list of all states, provinces, or territories for an ISO-2 country code.",
        parameters: {
          type: "object",
          properties: {
            countryCode: {
              type: "string",
              description:
                "The 2-letter ISO country code (e.g., 'IN', 'US', 'CA', 'GB')",
            },
          },
          required: ["countryCode"],
        },
      },
    ],
  });
});

/** Opal tool: country details */
app.post("/tools/get_country_details", (req: Request, res: Response) => {
  const query = String(req.body?.query ?? "").trim();
  if (!query) {
    return res.status(400).json({ error: "Missing required parameter: query" });
  }

  const result = findCountry(query);

  if (result.match) {
    return res.json(result.match);
  }

  return res.status(404).json({
    error: `Country not found for '${query}'`,
    suggestions: result.suggestions ?? [],
  });
});

/** Opal tool: states by country */
app.post("/tools/get_states_by_country", (req: Request, res: Response) => {
  const countryCode = String(req.body?.countryCode ?? "").trim();
  if (!countryCode) {
    return res
      .status(400)
      .json({ error: "Missing required parameter: countryCode" });
  }

  if (countryCode.length !== 2) {
    return res.status(400).json({
      error: "countryCode must be a 2-letter ISO code (e.g. 'IN', 'US')",
    });
  }

  const payload = getStatesByCountryCode(countryCode);
  if (payload.totalStates === 0) {
    const country = findCountry(countryCode);
    if (!country.match) {
      return res.status(404).json({
        error: `Unknown country code '${countryCode}'`,
        suggestions: country.suggestions ?? [],
      });
    }
  }

  return res.json(payload);
});

/**
 * REST helpers for dropdown forms / CMS workflows
 * (not Opal tools — used by the embeddable UI and Optimizely forms)
 */
app.get("/api/countries", (_req: Request, res: Response) => {
  res.json({ countries: listCountriesForDropdown() });
});

app.get("/api/countries/:code/states", (req: Request, res: Response) => {
  const code = String(req.params.code ?? "").trim();
  if (!code || code.length !== 2) {
    return res.status(400).json({ error: "Use a 2-letter ISO country code" });
  }

  const payload = getStatesByCountryCode(code);
  return res.json({
    countryCode: payload.countryCode,
    states: payload.states.map((s) => ({
      value: s.stateCode,
      label: s.name,
      type: s.type,
    })),
  });
});

/** CMS workflow: resolve country + states in one call */
app.post("/api/workflow/geo-lookup", (req: Request, res: Response) => {
  const query = String(req.body?.countryNameOrCode ?? req.body?.query ?? "").trim();
  const includeDetails = req.body?.includeDetails !== false;

  if (!query) {
    return res
      .status(400)
      .json({ error: "Missing countryNameOrCode (or query)" });
  }

  const countryResult = findCountry(query);
  if (!countryResult.match) {
    return res.status(404).json({
      error: `Country not found for '${query}'`,
      suggestions: countryResult.suggestions ?? [],
    });
  }

  const states = getStatesByCountryCode(countryResult.match.iso2);

  return res.json({
    country: includeDetails
      ? countryResult.match
      : { name: countryResult.match.name, iso2: countryResult.match.iso2 },
    totalStates: states.totalStates,
    states: states.states,
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "opal-geo-tools" });
});

app.listen(PORT, () => {
  console.log(`Geo Tool server running on http://localhost:${PORT}`);
  console.log(`  Manifest:  GET  /manifest`);
  console.log(`  Dropdown:  http://localhost:${PORT}/`);
  console.log(`  Workflow:  POST /api/workflow/geo-lookup`);
});
