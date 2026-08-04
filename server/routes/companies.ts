import { Router } from "express";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { handleApiError } from "../utils/errorHandler";
import { fromZodError } from "zod-validation-error";
import { insertCompanySchema } from "@shared/schema";
import { searchCompanyInfo } from "../utils/geminiClient";
import { formatOfficerName, formatAddress } from "../utils/formatters";
import { getSicDescription } from "../utils/sicCodeLookup";
import { chFetch } from "../utils/companiesHouseClient";

const router = Router();

  // UK Company Enrichment Agent
  router.post(
    "/companies/enrich",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { companyName, websiteUrl } = req.body;
        if (!companyName) {
          return res.status(400).json({ error: "Company name is required" });
        }

        console.log(
          `[Enrichment] Request received for: "${companyName}", Website: "${websiteUrl}"`
        );
        const result = await searchCompanyInfo(companyName, websiteUrl);
        res.json(result);
      } catch (error) {
        console.error("[Enrichment] API Error:", error);
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Companies House Search API - Protected route
  router.get("/companies-house/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 per API
      const activeOnly = req.query.active_only === "true";

      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      if (!process.env.COMPANIES_HOUSE_API_KEY) {
        console.error("COMPANIES_HOUSE_API_KEY environment variable not set");
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const response = await chFetch(
        `/search/companies?q=${encodeURIComponent(query)}&items_per_page=${limit}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
        });
      }

      const data = await response.json();

      // Filter out dissolved companies if activeOnly is true
      if (activeOnly && data.items) {
        data.items = data.items.filter(
          (company: any) =>
            company.company_status !== "dissolved" &&
            company.company_status !== "removed" &&
            company.company_status !== "closed"
        );
      }

      res.json(data);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Companies House Advanced Search API - Search by SIC, location, postcode
  router.get("/companies-house/advanced-search", isAuthenticated, async (req, res) => {
    try {
      const { sic_codes, location, postcode } = req.query;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const activeOnly = req.query.active_only === "true";

      if (!process.env.COMPANIES_HOUSE_API_KEY) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      // Use Advanced Search API which supports proper filtering
      // Documentation: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search
      const params = new URLSearchParams();
      params.append("size", limit.toString());

      // Build search parameters - can combine SIC codes with postcode filter
      if (sic_codes) {
        params.append("sic_codes", sic_codes as string);

        // Optional postcode filter with SIC code search
        if (postcode) {
          const formattedPostcode = (postcode as string).replace(/\s+/g, "").toUpperCase();
          params.append("location", formattedPostcode);
        }
      } else if (location) {
        // Filter by location (town/city in registered address)
        params.append("location", location as string);

        // Optional postcode filter with location search
        if (postcode) {
          const formattedPostcode = (postcode as string).replace(/\s+/g, "").toUpperCase();
          // Append postcode to location for more specific search
          params.set("location", `${location} ${formattedPostcode}`);
        }
      } else if (postcode) {
        // Filter by postcode only (registered office address)
        const formattedPostcode = (postcode as string).replace(/\s+/g, "").toUpperCase();
        params.append("location", formattedPostcode);
      } else {
        return res.status(400).json({ error: "At least one search parameter required" });
      }

      // Only search active companies if filter is enabled
      if (activeOnly) {
        params.append("company_status", "active");
      }

      const response = await chFetch(`/advanced-search/companies?${params.toString()}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House Advanced Search API error:", response.status, errorText);

        // If advanced search fails (e.g., not available on free tier), fall back to basic search
        if (response.status === 403 || response.status === 401) {
          const fallbackQuery = postcode || location || sic_codes;
          const fallbackResponse = await chFetch(
            `/search/companies?q=${encodeURIComponent(fallbackQuery as string)}&items_per_page=20`
          );

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            return res.json(fallbackData);
          }
        }

        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}`,
        });
      }

      const data = await response.json();
      // Advanced search returns slightly different format, normalize it
      const normalizedData = {
        items:
          data.items?.map((item: any) => {
            const addr = item.registered_office_address;
            return {
              title: item.company_name,
              company_number: item.company_number,
              company_status: item.company_status,
              company_type: item.company_type,
              address_snippet: addr
                ? [
                  addr.premises,
                  addr.address_line_1,
                  addr.address_line_2,
                  addr.locality,
                  addr.region,
                  addr.postal_code,
                  addr.country,
                ]
                  .filter(Boolean)
                  .join(", ")
                : undefined,
              address: addr,
              date_of_creation: item.date_of_creation,
              sic_codes: item.sic_codes,
            };
          }) || [],
        total_results: data.total_results || data.hits,
      };

      console.log(`Advanced search found ${normalizedData.items.length} companies`);
      res.json(normalizedData);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Companies House Officers Search API - Search for directors/officers
  router.get("/companies-house/search-officers", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }

      if (!process.env.COMPANIES_HOUSE_API_KEY) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      console.log(`Searching officers for: "${query}"`);

      const response = await chFetch(
        `/search/officers?q=${encodeURIComponent(query)}&items_per_page=20`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}`,
        });
      }

      const data = await response.json();
      console.log(`Found ${data.items?.length || 0} officers`);
      res.json(data);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Get officer appointments (companies they are a director of)
  router.get("/companies-house/officer-appointments", isAuthenticated, async (req, res) => {
    try {
      const officerId = req.query.officer_id as string;
      const redirectUrl = (req.query.redirect as string) || "/underwriting";
      if (!officerId) {
        return res.status(400).json({ error: "Officer ID is required" });
      }

      if (!process.env.COMPANIES_HOUSE_API_KEY) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      console.log(`Fetching appointments for officer: "${officerId}"`);

      const response = await chFetch(
        `/officers/${encodeURIComponent(officerId)}/appointments`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}`,
        });
      }

      const data = await response.json();
      console.log(`Found ${data.items?.length || 0} appointments`);
      res.json(data);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Companies House Company Profile API - Protected route
  router.get("/companies-house/company/:companyNumber", isAuthenticated, async (req, res) => {
    try {
      const companyNumber = req.params.companyNumber;
      if (!companyNumber || companyNumber.trim().length === 0) {
        return res.status(400).json({ error: "Company number is required" });
      }

      if (!process.env.COMPANIES_HOUSE_API_KEY) {
        console.error("COMPANIES_HOUSE_API_KEY environment variable not set");
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      console.log(`Fetching company profile for: "${companyNumber}"`);

      const response = await chFetch(`/company/${encodeURIComponent(companyNumber)}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Companies House API error:", response.status, errorText);
        if (response.status === 404) {
          return res.status(404).json({ error: "Company not found" });
        }
        return res.status(response.status).json({
          error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
        });
      }

      const data = await response.json();
      console.log(`Retrieved company profile for ${companyNumber}`);
      res.json(data);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Companies House Officers API - Protected route
  router.get(
    "/companies-house/company/:companyNumber/officers",
    isAuthenticated,
    async (req, res) => {
      try {
        const companyNumber = req.params.companyNumber;
        if (!process.env.COMPANIES_HOUSE_API_KEY) {
          return res.status(500).json({ error: "Companies House API key not configured" });
        }

        console.log(`Fetching officers for: "${companyNumber}"`);

        const response = await chFetch(
          `/company/${encodeURIComponent(companyNumber)}/officers`
        );

        if (!response.ok) {
          if (response.status === 404) {
            return res.status(404).json({ error: "Officers not found" });
          }
          const errorText = await response.text();
          console.error("Companies House API error:", response.status, errorText);
          return res.status(response.status).json({
            error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
          });
        }

        const data = await response.json();
        console.log(`Retrieved ${data.items?.length || 0} officers for ${companyNumber}`);
        res.json(data);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Companies House PSC API - Protected route
  router.get(
    "/companies-house/company/:companyNumber/persons-with-significant-control",
    isAuthenticated,
    async (req, res) => {
      try {
        const companyNumber = req.params.companyNumber;
        if (!process.env.COMPANIES_HOUSE_API_KEY) {
          return res.status(500).json({ error: "Companies House API key not configured" });
        }

        console.log(`Fetching PSC for: "${companyNumber}"`);

        const response = await chFetch(
          `/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`
        );

        if (!response.ok) {
          if (response.status === 404) {
            return res.status(404).json({ error: "PSC data not found" });
          }
          const errorText = await response.text();
          console.error("Companies House API error:", response.status, errorText);
          return res.status(response.status).json({
            error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
          });
        }

        const data = await response.json();
        console.log(`Retrieved ${data.items?.length || 0} PSCs for ${companyNumber}`);
        res.json(data);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Companies House Charges API - Protected route
  router.get(
    "/companies-house/company/:companyNumber/charges",
    isAuthenticated,
    async (req, res) => {
      try {
        const companyNumber = req.params.companyNumber;
        if (!process.env.COMPANIES_HOUSE_API_KEY) {
          return res.status(500).json({ error: "Companies House API key not configured" });
        }

        console.log(`Fetching charges for: "${companyNumber}"`);

        const response = await chFetch(
          `/company/${encodeURIComponent(companyNumber)}/charges`
        );

        if (!response.ok) {
          if (response.status === 404) {
            // 404 means no charges, return empty data
            return res.json({ total_count: 0, items: [] });
          }
          const errorText = await response.text();
          console.error("Companies House API error:", response.status, errorText);
          return res.status(response.status).json({
            error: `Companies House API returned ${response.status}: ${errorText || response.statusText}`,
          });
        }

        const data = await response.json();
        console.log(`Retrieved ${data.total_count || 0} charges for ${companyNumber}`);
        res.json(data);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Associated companies search - Premium feature
  router.get(
    "/prospects/:prospectId/associated-companies",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);

        // Check user subscription - Premium only
        const user = await storage.getUser(userId);
        if (!user || user.subscriptionTier !== "premium") {
          return res
            .status(403)
            .json({ error: "This feature is only available for Premium users" });
        }

        // Get prospect and company info
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const companyNumber = prospect.company.companyNumber;
        if (!companyNumber) {
          return res.json({ officers: [], psc: [], sameAddress: [] });
        }

        if (!process.env.COMPANIES_HOUSE_API_KEY) {
          return res.status(500).json({ error: "Companies House API key not configured" });
        }

        // Fetch officers and PSC for the company
        const [officersRes, pscRes] = await Promise.all([
          chFetch(`/company/${encodeURIComponent(companyNumber)}/officers`).catch(() => null),
          chFetch(
            `/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`
          ).catch(() => null),
        ]);

        const officers = officersRes && officersRes.ok ? await officersRes.json() : { items: [] };
        const psc = pscRes && pscRes.ok ? await pscRes.json() : { items: [] };

        // Find companies with common officers
        const officerNames =
          officers.items?.filter((o: any) => !o.resigned_on).map((o: any) => o.name) || [];
        const companiesViaOfficers: any[] = [];

        for (const officerName of officerNames.slice(0, 5)) {
          // Limit to prevent too many API calls
          try {
            const searchRes = await chFetch(
              `/search/officers?q=${encodeURIComponent(officerName)}&items_per_page=5`
            );

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              for (const item of searchData.items || []) {
                if (item.links?.officer?.appointments) {
                  const appointmentsRes = await chFetch(item.links.officer.appointments);

                  if (appointmentsRes.ok) {
                    const appointments = await appointmentsRes.json();
                    for (const appointment of appointments.items || []) {
                      if (
                        appointment.appointed_to?.company_number !== companyNumber &&
                        !appointment.resigned_on
                      ) {
                        companiesViaOfficers.push({
                          company_number: appointment.appointed_to?.company_number,
                          company_name: appointment.appointed_to?.company_name,
                          company_status: appointment.appointed_to?.company_status,
                          officer_name: officerName,
                          officer_role: appointment.officer_role,
                          appointed_on: appointment.appointed_on,
                        });
                      }
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error(`Error searching for officer ${officerName}:`, err);
          }
        }

        // Find companies with common PSC
        const pscNames = psc.items?.filter((p: any) => !p.ceased_on).map((p: any) => p.name) || [];
        const companiesViaPSC: any[] = [];

        for (const pscName of pscNames.slice(0, 3)) {
          try {
            const searchRes = await chFetch(
              `/search/companies?q=${encodeURIComponent(pscName)}&items_per_page=10`
            );

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              for (const company of searchData.items || []) {
                if (company.company_number !== companyNumber) {
                  companiesViaPSC.push({
                    company_number: company.company_number,
                    company_name: company.title,
                    company_status: company.company_status,
                    psc_name: pscName,
                    address_snippet: company.address_snippet,
                  });
                }
              }
            }
          } catch (err) {
            console.error(`Error searching for PSC ${pscName}:`, err);
          }
        }

        // Find companies at same registered address
        const companiesSameAddress: any[] = [];
        const address = prospect.company.registeredAddress;
        if (address) {
          try {
            const addressQuery = `${address}`.substring(0, 100);
            const searchRes = await chFetch(
              `/search/companies?q=${encodeURIComponent(addressQuery)}&items_per_page=10`
            );

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              for (const company of searchData.items || []) {
                if (
                  company.company_number !== companyNumber &&
                  company.address_snippet?.includes(addressQuery.substring(0, 20))
                ) {
                  companiesSameAddress.push({
                    company_number: company.company_number,
                    company_name: company.title,
                    company_status: company.company_status,
                    address_snippet: company.address_snippet,
                  });
                }
              }
            }
          } catch (err) {
            console.error("Error searching for companies at same address:", err);
          }
        }

        // Remove duplicates and limit results
        const uniqueOfficers = Array.from(
          new Map(companiesViaOfficers.map((c) => [c.company_number, c])).values()
        ).slice(0, 10);
        const uniquePSC = Array.from(
          new Map(companiesViaPSC.map((c) => [c.company_number, c])).values()
        ).slice(0, 10);
        const uniqueAddress = Array.from(
          new Map(companiesSameAddress.map((c) => [c.company_number, c])).values()
        ).slice(0, 10);

        res.json({
          officers: uniqueOfficers,
          psc: uniquePSC,
          sameAddress: uniqueAddress,
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // AI web search for company - Premium feature
  router.post(
    "/prospects/:prospectId/web-search",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);

        // Check user subscription - Premium only
        const user = await storage.getUser(userId);
        if (!user || user.subscriptionTier !== "premium") {
          return res
            .status(403)
            .json({ error: "This feature is only available for Premium users" });
        }

        // Get prospect and company info
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        const tavilyApiKey = process.env.TAVILY_API_KEY;
        if (!tavilyApiKey) {
          return res.status(500).json({ error: "Tavily API key not configured" });
        }

        const companyName = prospect.company.companyName;
        const searchQuery = `${companyName} UK company news information`;

        console.log(`Searching web for company: ${companyName}`);

        const tavilyResponse = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query: searchQuery,
            search_depth: "basic",
            include_answer: true,
            include_raw_content: false,
            max_results: 10,
            include_domains: [],
            exclude_domains: [],
          }),
        });

        if (!tavilyResponse.ok) {
          const errorText = await tavilyResponse.text();
          console.error("Tavily API error:", tavilyResponse.status, errorText);
          return res.status(tavilyResponse.status).json({
            error: `Tavily API returned ${tavilyResponse.status}: ${errorText || tavilyResponse.statusText}`,
          });
        }

        const data = await tavilyResponse.json();
        console.log(`Found ${data.results?.length || 0} web results for ${companyName}`);

        res.json({
          answer: data.answer || "",
          results: data.results || [],
          query: searchQuery,
        });
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Character Assessment "investigate" — background/social search on a named
  // individual, used to build a fuller picture of directors/guarantors.
  router.post("/character-search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { name, company } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "A person's name is required" });
      }

      const tavilyApiKey = process.env.TAVILY_API_KEY;
      if (!tavilyApiKey) {
        return res.status(500).json({ error: "Tavily API key not configured" });
      }

      const context = company ? ` ${company}` : "";
      const webQuery = `"${name}"${context} director UK business background news`;
      const socialQuery = `"${name}"${context} LinkedIn profile`;

      const runSearch = async (query: string, includeDomains: string[] = []) => {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tavilyApiKey,
            query,
            search_depth: "basic",
            include_answer: true,
            include_raw_content: false,
            max_results: 8,
            include_domains: includeDomains,
            exclude_domains: [],
          }),
        });
        if (!response.ok) {
          console.error("Tavily API error:", response.status, await response.text());
          return { answer: "", results: [] };
        }
        const data = await response.json();
        return { answer: data.answer || "", results: data.results || [] };
      };

      const [web, social] = await Promise.all([
        runSearch(webQuery),
        runSearch(socialQuery, ["linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com"]),
      ]);

      console.log(`Character search for "${name}": ${web.results.length} web, ${social.results.length} social results`);

      res.json({ web, social });
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Save selected associations
  router.post(
    "/prospects/:prospectId/save-associations",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const prospectId = parseInt(req.params.prospectId);
        const { associations } = req.body;

        // Validate associations is an array
        if (!Array.isArray(associations)) {
          return res.status(400).json({ error: "Associations must be an array" });
        }

        // Limit to 50 associations maximum
        if (associations.length > 50) {
          return res.status(400).json({ error: "Maximum 50 associations allowed" });
        }

        // Verify prospect ownership
        const prospect = await storage.getProspect(prospectId, userId);
        if (!prospect) {
          return res.status(404).json({ error: "Prospect not found" });
        }

        // Update prospect with saved associations
        const updated = await storage.updateProspect(prospectId, userId, {
          savedAssociations: associations,
        });

        res.json(updated);
      } catch (error) {
        handleApiError(res, error, "api-error");
      }
    }
  );

  // Companies API - Protected routes

  // Specific route for fetching by numeric ID
  router.get("/companies/:id(\\d+)", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      console.log(`[API] Fetching company by ID: ${companyId}`);
      const company = await storage.getCompanyById(companyId);
      console.log(`[API] Company result:`, company ? "Found" : "Not Found");
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error(`[API] Error fetching company ${req.params.id}:`, error);
      handleApiError(res, error, "api-error");
    }
  });

  // Fallback for company number (string)
  router.get("/companies/:number", isAuthenticated, async (req, res) => {
    try {
      const company = await storage.getCompanyByNumber(req.params.number);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  router.post("/companies", isAuthenticated, async (req, res) => {
    try {
      const result = insertCompanySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).toString() });
      }

      const existingCompany = await storage.getCompanyByNumber(result.data.companyNumber);
      if (existingCompany) {
        return res.json(existingCompany);
      }

      // Add SIC description if sicCode is provided
      const companyData = {
        ...result.data,
        sicDescription: result.data.sicCode ? getSicDescription(result.data.sicCode) : null,
      };

      const company = await storage.createCompany(companyData);
      res.json(company);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Update company details (e.g., sync incorporation date from Companies House)
  router.patch("/companies/:id", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Invalid company ID" });
      }

      const {
        incorporationDate,
        companyStatus,
        registeredAddress,
        postcode,
        sicCode,
        sicDescription,
        website,
      } = req.body;

      // Build update object with only provided fields
      const updates: Partial<{
        incorporationDate: string;
        companyStatus: string;
        registeredAddress: string;
        postcode: string;
        sicCode: string;
        sicDescription: string;
        website: string;
      }> = {};
      if (incorporationDate !== undefined) updates.incorporationDate = incorporationDate;
      if (companyStatus !== undefined) updates.companyStatus = companyStatus;
      if (registeredAddress !== undefined) updates.registeredAddress = registeredAddress;
      if (postcode !== undefined) updates.postcode = postcode;
      if (sicCode !== undefined) updates.sicCode = sicCode;
      if (sicDescription !== undefined) updates.sicDescription = sicDescription;
      if (website !== undefined) updates.website = website;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      const company = await storage.updateCompany(companyId, updates);
      res.json(company);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Sync company data from Companies House (SIC codes, postcode, etc.)
  router.post("/companies/:id/sync-companies-house", isAuthenticated, async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      if (isNaN(companyId)) {
        return res.status(400).json({ error: "Invalid company ID" });
      }

      // Get the company to find the company number
      const companyRecord = await storage.getCompanyById(companyId);
      if (!companyRecord) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Skip non-registered companies
      if (companyRecord.companyNumber.startsWith("UNREG-")) {
        return res.status(400).json({ error: "Cannot sync unregistered companies" });
      }

      if (!process.env.COMPANIES_HOUSE_API_KEY) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      // Fetch company profile from Companies House
      const response = await chFetch(
        `/company/${encodeURIComponent(companyRecord.companyNumber)}`
      );

      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: "Failed to fetch company data from Companies House" });
      }

      const chData = await response.json();

      // Build update object
      const updates: Partial<{
        sicCode: string;
        sicDescription: string;
        postcode: string;
        registeredAddress: string;
        companyStatus: string;
        incorporationDate: string;
      }> = {};

      // Extract SIC code
      if (chData.sic_codes && chData.sic_codes.length > 0) {
        updates.sicCode = chData.sic_codes[0];
        updates.sicDescription = getSicDescription(chData.sic_codes[0]);
      }

      // Extract postcode and address
      if (chData.registered_office_address) {
        const addr = chData.registered_office_address;
        if (addr.postal_code) {
          updates.postcode = addr.postal_code;
        }
        // Build full address
        const addressParts = [
          addr.premises,
          addr.address_line_1,
          addr.address_line_2,
          addr.locality,
          addr.region,
          addr.postal_code,
          addr.country,
        ].filter(Boolean);
        if (addressParts.length > 0) {
          updates.registeredAddress = addressParts.join(", ");
        }
      }

      // Extract status and incorporation date
      if (chData.company_status) {
        updates.companyStatus = chData.company_status;
      }
      if (chData.date_of_creation) {
        updates.incorporationDate = chData.date_of_creation;
      }

      if (Object.keys(updates).length === 0) {
        return res.json({ message: "No updates available", company: companyRecord });
      }

      const updatedCompany = await storage.updateCompany(companyId, updates);
      res.json(updatedCompany);
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });

  // Auto-sync officers from Companies House to contacts
  router.post("/prospects/:prospectId/sync-officers", isAuthenticated, async (req, res) => {
    try {
      const prospectId = parseInt(req.params.prospectId);
      const userId = req.user!.id;

      // Get the prospect to find the company number
      const prospect = await storage.getProspect(prospectId, userId);
      if (!prospect) {
        return res.status(404).json({ error: "Prospect not found" });
      }

      const companyNumber = prospect.company.companyNumber;
      if (!companyNumber) {
        return res.status(400).json({ error: "No company number available" });
      }

      // Fetch officers from Companies House
      if (!process.env.COMPANIES_HOUSE_API_KEY) {
        return res.status(500).json({ error: "Companies House API key not configured" });
      }

      const officersResponse = await chFetch(`/company/${companyNumber}/officers`);

      if (!officersResponse.ok) {
        return res.status(officersResponse.status).json({ error: "Failed to fetch officers" });
      }

      const officersData = await officersResponse.json();
      const activeOfficers = officersData.items?.filter((o: any) => !o.resigned_on) || [];

      // Get existing contacts
      const existingContacts = await storage.listContacts(prospectId, userId);
      const existingNames = new Set(existingContacts.map((c) => c.name.toLowerCase().trim()));

      // Create contacts for officers not already in contacts
      const newContacts = [];
      for (const officer of activeOfficers) {
        const formattedName = formatOfficerName(officer.name);
        if (!existingNames.has(formattedName.toLowerCase().trim())) {
          const role =
            officer.officer_role
              ?.replace(/-/g, " ")
              .replace(/\b\w/g, (l: string) => l.toUpperCase()) || "Officer";
          const contact = await storage.createContact(
            {
              prospectId: prospectId as number,
              name: formattedName,
              role,
            } as any,
            userId
          );
          if (contact) newContacts.push(contact);
        }
      }

      // Return all contacts
      const allContacts = await storage.listContacts(prospectId, userId);
      res.json({
        contacts: allContacts,
        synced: newContacts.length,
        message:
          newContacts.length > 0
            ? `Synced ${newContacts.length} officer(s)`
            : "All officers already synced",
      });
    } catch (error) {
      handleApiError(res, error, "api-error");
    }
  });


export default router;
