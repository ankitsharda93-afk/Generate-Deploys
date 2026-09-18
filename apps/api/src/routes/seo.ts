import { Router } from "express";
import { z } from "zod";
import { SEO_EXPERT_SYSTEM_INSTRUCTION } from "../lib/seoExpertSystem.js";

export const seoRouter = Router();

const BodySchema = z.object({
  topicOrUrl: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
});

type SeoHeading = { tag: "H1" | "H2" | "H3"; text: string };
type SeoOutlineItem = { heading: string; bullets: string[] };

type SeoStructureResponse = {
  Meta_Title: string;
  Meta_Description: string;
  Primary_Keywords: [string, string, string];
  LSI_Keywords: [string, string, string, string, string];
  Heading_Structure: SeoHeading[];
  Content_Outline: SeoOutlineItem[];
  Image_Alt_Text_Suggestions: [string, string, string];
  Slug_Recommendation: string;
};

const toTrimmedString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const normalizeStringArray = (value: unknown, targetLen: number): string[] => {
  const arr = Array.isArray(value) ? value : [];
  const cleaned = arr.map(toTrimmedString).filter(Boolean).slice(0, targetLen);
  while (cleaned.length < targetLen) cleaned.push("");
  return cleaned;
};

const extractJsonObjectString = (text: string): string => {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (raw.startsWith("{") && raw.endsWith("}")) return raw;
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) return raw.slice(first, last + 1);
  return "";
};

const normalizeHeadingStructure = (value: unknown): SeoHeading[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): SeoHeading | null => {
      if (typeof item === "string") {
        const s = item.trim();
        const match = s.match(/^(H[1-6])\s*[:\-]\s*(.+)$/i);
        if (match) {
          const tag = match[1].toUpperCase();
          const text = match[2].trim();
          if (tag === "H1" || tag === "H2" || tag === "H3") return { tag, text };
          return { tag: "H2", text };
        }
        return s ? { tag: "H2", text: s } : null;
      }
      if (item && typeof item === "object") {
        const tag = toTrimmedString((item as any).tag).toUpperCase();
        const text = toTrimmedString((item as any).text) || toTrimmedString((item as any).heading);
        if (!text) return null;
        if (tag === "H1" || tag === "H2" || tag === "H3") return { tag, text };
        return { tag: "H2", text };
      }
      return null;
    })
    .filter((x): x is SeoHeading => Boolean(x));
};

const normalizeContentOutline = (value: unknown): SeoOutlineItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): SeoOutlineItem | null => {
      if (typeof item === "string") {
        const heading = item.trim();
        return heading ? { heading, bullets: [] } : null;
      }
      if (item && typeof item === "object") {
        const heading = toTrimmedString((item as any).heading) || toTrimmedString((item as any).title);
        const bullets = Array.isArray((item as any).bullets)
          ? (item as any).bullets.map(toTrimmedString).filter(Boolean)
          : [];
        if (!heading && bullets.length === 0) return null;
        return { heading, bullets };
      }
      return null;
    })
    .filter((x): x is SeoOutlineItem => Boolean(x));
};

const sanitizeSeoStructure = (value: unknown): SeoStructureResponse => {
  const obj = value && typeof value === "object" ? (value as any) : {};
  const metaTitle = toTrimmedString(obj.Meta_Title).slice(0, 60);
  const metaDescription = toTrimmedString(obj.Meta_Description).slice(0, 155);

  const primary = normalizeStringArray(obj.Primary_Keywords, 3) as [string, string, string];
  const lsi = normalizeStringArray(obj.LSI_Keywords, 5) as [string, string, string, string, string];
  const imageAlt = normalizeStringArray(obj.Image_Alt_Text_Suggestions, 3) as [string, string, string];

  return {
    Meta_Title: metaTitle,
    Meta_Description: metaDescription,
    Primary_Keywords: primary,
    LSI_Keywords: lsi,
    Heading_Structure: normalizeHeadingStructure(obj.Heading_Structure),
    Content_Outline: normalizeContentOutline(obj.Content_Outline),
    Image_Alt_Text_Suggestions: imageAlt,
    Slug_Recommendation: toTrimmedString(obj.Slug_Recommendation),
  };
};

seoRouter.post("/structure", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(501).json({
      error: "Missing OPENAI_API_KEY. Set it in apps/api/.env to enable /v1/seo/structure.",
    });
  }

  const parsed = BodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const topicOrUrl = toTrimmedString(parsed.data.topicOrUrl || parsed.data.topic || parsed.data.url);
  if (!topicOrUrl) {
    return res.status(400).json({
      error: 'Missing "topicOrUrl" in request body. Example: { "topicOrUrl": "best running shoes" }',
    });
  }

  const model = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const userPrompt = [
    "Analyze the provided TOPIC/URL and return ONLY valid JSON (no markdown, no backticks).",
    "",
    `TOPIC/URL: ${topicOrUrl}`,
    "",
    "Use exactly these keys and types:",
    '{ "Meta_Title": "string", "Meta_Description": "string", "Primary_Keywords": ["string","string","string"], "LSI_Keywords": ["string","string","string","string","string"], "Heading_Structure": [{"tag":"H1|H2|H3","text":"string"}], "Content_Outline": [{"heading":"string","bullets":["string"]}], "Image_Alt_Text_Suggestions": ["string","string","string"], "Slug_Recommendation": "string" }',
    "",
    "Constraints: Meta_Title max 60 chars (include main keyword). Meta_Description max 155 chars (high CTR).",
  ].join("\n");

  let upstreamJson: any = null;
  let upstreamStatus = 0;
  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SEO_EXPERT_SYSTEM_INSTRUCTION },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    upstreamStatus = upstream.status;
    upstreamJson = await upstream.json().catch(() => null);
  } catch (e) {
    return res.status(502).json({ error: "Failed to reach OpenAI.", details: e instanceof Error ? e.message : String(e) });
  }

  const content: string =
    upstreamJson?.choices?.[0]?.message?.content ??
    upstreamJson?.choices?.[0]?.message?.refusal ??
    "";

  try {
    const jsonString = extractJsonObjectString(content);
    const parsedJson = JSON.parse(jsonString);
    return res.json(sanitizeSeoStructure(parsedJson));
  } catch {
    return res.status(502).json({
      error: "Failed to parse model JSON response.",
      upstream_status: upstreamStatus,
      upstream_body_preview: JSON.stringify(upstreamJson)?.slice(0, 800) ?? "",
    });
  }
});

