import type { SheetRow } from "@sheet-to-pages/shared";

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function extractPhoneFromContent(contentHtml: string) {
  // Prefer explicit tel: links if present.
  const telMatch = contentHtml.match(/href=["']tel:([^"']+)["']/i);
  if (telMatch?.[1]) return telMatch[1].trim();

  // Fallback: first phone-ish chunk.
  const phoneish = contentHtml.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return phoneish?.[1]?.trim() ?? "";
}

function extractAddressFromContent(contentHtml: string) {
  // Matches: <p><b>Address:</b> 123 Main St, City, ST 12345</p>
  const m = contentHtml.match(/<b>\s*Address:\s*<\/b>\s*([^<]+)</i);
  return m?.[1]?.trim() ?? "";
}

function googleMapsLink(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function digitsOnlyPhone(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

export function renderIndexHtml(row: SheetRow) {
  const title = escapeHtml(row.title);
  const description = escapeHtml(row.description ?? "");
  
  // Simple deterministic hash based on title
  const hash = title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const heroImages = [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600&q=80",
    "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1600&q=80",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1600&q=80",
    "https://images.unsplash.com/photo-1556911220-e150223eaa77?w=1600&q=80",
    "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=1600&q=80",
    "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=1600&q=80",
    "https://images.unsplash.com/photo-1603614486387-276f74fcbe2a?w=1600&q=80",
    "https://images.unsplash.com/photo-1583907659441-add970034a74?w=1600&q=80",
  ];

  const projectImages = [
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80",
    "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&q=80",
    "https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?w=800&q=80",
    "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800&q=80",
    "https://images.unsplash.com/photo-1550963295-019d8a8a61c5?w=800&q=80",
    "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800&q=80",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80",
    "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=800&q=80",
    "https://images.unsplash.com/photo-1590650153855-d9e808231d41?w=800&q=80",
  ];


  const expertiseImages = [
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000&q=80",
    "https://images.unsplash.com/photo-1600047509807-ba846436eeae?w=1000&q=80",
    "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1000&q=80",
    "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1000&q=80",
    "https://images.unsplash.com/photo-1605276374104-dee2a0bd3cd6?w=1000&q=80",
    "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1000&q=80",
    "https://images.unsplash.com/photo-1513584684004-99d973ef662a?w=1000&q=80",
    "https://images.unsplash.com/photo-1448630303231-736ed1746769?w=1000&q=80",
  ];

  const image = row.image?.trim() ? row.image.trim() : heroImages[hash % heroImages.length];
  const p1 = projectImages[(hash + 1) % projectImages.length];
  const p2 = projectImages[(hash + 2) % projectImages.length];
  const p3 = projectImages[(hash + 3) % projectImages.length];
  const expertiseImg = expertiseImages[(hash + 4) % expertiseImages.length];

  // `content` is allowed to include basic HTML; if you want strict escaping, replace with escapeHtml(row.content)
  const contentHtml = (row.content ?? "").trim();

  const ogImage = image ? escapeHtml(image) : "https://placehold.co/1200x630/png?text=" + encodeURIComponent(row.title);
  const phone = extractPhoneFromContent(contentHtml);
  const address = extractAddressFromContent(contentHtml);
  const mapsUrl = address ? googleMapsLink(address) : "";
  const waDigits = phone ? digitsOnlyPhone(phone) : "";
  const whatsappUrl = waDigits ? `https://wa.me/${waDigits}` : "";
  const locationFromTitle = row.title.includes(" in ") ? row.title.split(" in ").slice(1).join(" in ").trim() : "";
  const serviceName = row.title.includes(" in ") ? row.title.split(" in ")[0].trim() : row.title.trim();
  const leadEndpoint = process.env.PUBLIC_API_BASE_URL?.trim() || "";

  // Dynamic Theme Selection
  const themes = [
    { name: "Classic Indigo", primary: "#4f46e5", dark: "#312e81", accent: "#818cf8", bg: "#f8fafc", icon: "💧" },
    { name: "Forest Emerald", primary: "#059669", dark: "#064e3b", accent: "#34d399", bg: "#f0fdf4", icon: "🌿" },
    { name: "Sunset Orange", primary: "#ea580c", dark: "#7c2d12", accent: "#fb923c", bg: "#fff7ed", icon: "⚡" },
    { name: "Royal Slate", primary: "#334155", dark: "#0f172a", accent: "#94a3b8", bg: "#f1f5f9", icon: "🏢" },
    { name: "Oceanic Cyan", primary: "#0891b2", dark: "#164e63", accent: "#22d3ee", bg: "#ecfeff", icon: "🌊" },
    { name: "Deep Maroon", primary: "#991b1b", dark: "#450a0a", accent: "#ef4444", bg: "#fef2f2", icon: "🚨" },
  ];

  const fonts = [
    { head: "'Outfit', sans-serif", body: "'Inter', sans-serif" },
    { head: "'Montserrat', sans-serif", body: "'Open Sans', sans-serif" },
    { head: "'Fraunces', serif", body: "'Inter', sans-serif" },
    { head: "'Sora', sans-serif", body: "'Plus Jakarta Sans', sans-serif" },
  ];

  // hash moved up to use in image selection
  const theme = themes[hash % themes.length];
  const font = fonts[hash % fonts.length];
  const borderRadius = (hash % 2 === 0) ? "24px" : "12px";
  const buttonRadius = (hash % 3 === 0) ? "99px" : "16px";

  const lowerTitle = title.toLowerCase();

  // Dynamic Content Categories Pool
  const allServicesPool = [
    { icon: "🧹", title: "Deep Dusting", desc: "Removing allergens and dust from every corner, including hard-to-reach areas." },
    { icon: "🧪", title: "Eco-Friendly", desc: "Using safe, non-toxic products that are powerful on dirt but kind to pets." },
    { icon: "🏠", title: "Residential Care", desc: "Complete home cleaning tailored to your lifestyle and specific needs." },
    { icon: "🧼", title: "Sanitization", desc: "Eliminating 99.9% of bacteria and viruses from high-touch surfaces." },
    { icon: "✨", title: "Polishing", desc: "Restoring the original shine to wood, metal, and glass throughout your home." },
    { icon: "📅", title: "Recurring Service", desc: "Flexible weekly or monthly schedules to keep your space consistently clean." },
    { icon: "📦", title: "Move-In/Out", desc: "Comprehensive top-to-bottom cleaning for a fresh start in your new location." },
    { icon: "🛋️", title: "Upholstery Care", desc: "Gentle yet effective cleaning for sofas, curtains, and delicate fabrics." },
    { icon: "🌡️", title: "Steam Cleaning", desc: "High-temperature steam to lift deep-seated dirt without harsh chemicals." },
    { icon: "🧽", title: "Detailed Scrub", desc: "Focusing on baseboards, light switches, and those easily missed spots." }
  ];

  const categories = [
    {
      keywords: ["kitchen"],
      expertise: {
        title: "Culinary Care Experts",
        p1: "Kitchens are the heart of any space, but they also harbor the most grime. We specialize in deep-cleaning cooking environments.",
        p2: "Our team focuses on FDA-grade sanitization, ensuring every surface is safe for food preparation and free of grease buildup."
      },
      stories: [
        { title: "State St Kitchen Rescue", desc: "Complete degreasing of a high-volume residential kitchen that hadn't been deep-cleaned in years.", badge: "Deep Clean" },
        { title: "Bistro Level Sanitation", desc: "Bringing industrial-strength cleaning standards to a luxury home kitchen environment.", badge: "Hygienic" },
        { title: "Stovetop Transformation", desc: "Restored a heavily burnt stovetop and vent hood to showroom condition.", badge: "Detailing" }
      ],
      services: [
        { icon: "🍳", title: "Deep Kitchen Scrub", desc: "Heavy-duty degreasing and sanitization of all surfaces, including behind appliances." },
        { icon: "✨", title: "Appliance Detailing", desc: "Restoring the shine to your oven, fridge, and stovetop with professional-grade polish." },
        { icon: "🧼", title: "Sanitary Cabinetry", desc: "Removing grease and grime from cabinets, leaving them clean enough to eat from." },
        { icon: "💎", title: "Countertop Care", desc: "Specialized cleaning for granite, marble, or quartz to protect and shine." }
      ]
    },
    {
      keywords: ["bathroom", "bath"],
      expertise: {
        title: "Sanitary Perfection",
        p1: "Bathrooms require more than just a quick wipe. We tackle the hidden bacteria and limescale that normal cleaning misses.",
        p2: "From porcelain restoration to grout whitening, we transform your most private space into a spa-like sanctuary."
      },
      stories: [
        { title: "Master Bath Restoration", desc: "Removed 5 years of hard-water buildup and mold from a luxury stone-tile bathroom.", badge: "Verified" },
        { title: "Guest Wing Sparkle", desc: "Ensuring an entire floor of restrooms was sterile and sparkling for an upcoming event.", badge: "Sanitary" },
        { title: "Grout Color Matching", desc: "Cleaned and resealed grout to bring back the original bright white of a modern shower.", badge: "Technical" }
      ],
      services: [
        { icon: "🛁", title: "Grout Restoration", desc: "Advanced mold removal and scrub to make your tiles and grout look brand new." },
        { icon: "🧽", title: "Deep Disinfection", desc: "Medical-grade sanitization of toilets, sinks, and showers for a germ-free space." },
        { icon: "💎", title: "Glass & Chrome", desc: "Streak-free shine for mirrors and fixtures with specialized scale-removing tech." },
        { icon: "💧", title: "Mildew Control", desc: "Proactive treatments to prevent moisture-related growth in damp areas." }
      ]
    },
    {
      keywords: ["restoration", "water", "melt", "leak", "flood", "seepage", "drain"],
      expertise: {
        title: "Rapid Response Crew",
        p1: "When it comes to water damage, every second counts. We specialize in immediate moisture extraction and mitigation.",
        p2: "Our structural drying techniques ensure that your property is safe from mold and long-term decay."
      },
      stories: [
        { title: "Main St Flood Recovery", desc: "Extracted 200 gallons of water and completed structural drying in under 24 hours.", badge: "Emergency" },
        { title: "Basement Seepage Fix", desc: "Corrected and cleaned a recurring seepage issue, restoring the space to usable condition.", badge: "Mitigation" },
        { title: "Threshold Leak Repair", desc: "Stopped and repaired a complex entryway leak that was damaging the subfloor.", badge: "Structural" }
      ],
      services: [
        { icon: "❄️", title: "Moisture Extraction", desc: "Rapid water removal using industrial-grade truck-mounted extraction systems." },
        { icon: "💨", title: "Structural Drying", desc: "High-speed air movers and dehumidifiers to prevent mold and wood rot." },
        { icon: "🛡️", title: "Mold Prevention", desc: "Antimicrobial treatments to keep your property safe and healthy long-term." },
        { icon: "🌡️", title: "Thermal Imaging", desc: "Detecting hidden moisture behind walls to ensure total dryness." }
      ]
    },

    {
      keywords: ["office", "commercial", "industrial", "business"],
      expertise: {
        title: "Enterprise Solutions",
        p1: "Commercial spaces require a different level of precision. We understand the regulatory and operational demands of your facility.",
        p2: "Whether you manage a boutique office or a large industrial complex, we bring the professionalism your business deserves."
      },
      stories: [
        { title: "Corporate Plaza Hygiene", desc: "A 5-day intensive deep clean for a 50,000 sq ft office building after a major renovation.", badge: "Enterprise" },
        { title: "Retail Entrance Shine", desc: "Restoring the high-traffic luxury floors of a downtown shopping arcade to mirror-finish.", badge: "Commercial" },
        { title: "Clinic Level Sanitization", desc: "High-spec disinfection for a surgery center, meeting all health and safety benchmarks.", badge: "Medical Grade" }
      ],
      services: [
        { icon: "🏢", title: "Workspace Hygiene", desc: "Keeping your team healthy with desk-to-ceiling cleaning and disinfection." },
        { icon: "🧹", title: "Floor Maintenance", desc: "High-traffic floor care including buffing, waxing, and deep carpet extraction." },
        { icon: "🌙", title: "After-Hours Service", desc: "Reliable, secure cleaning scheduled precisely when your business is closed." },
        { icon: "🪟", title: "Facade Cleaning", desc: "Maintaining a professional exterior with window and entrance-way care." }
      ]
    },
    {
      keywords: ["carpet", "floor", "rug"],
      expertise: {
        title: "Floor Surface Mastery",
        p1: "Every floor tells a story, and we make yours look brand new. From delicate Persian rugs to high-traffic hardwoods.",
        p2: "We use specialized equipment that removes deep-seated allergens without damaging the structural integrity of your flooring."
      },
      stories: [
        { title: "Persian Rug Revival", desc: "Delicate restoration of a 50-year-old silk rug, removing decades of dust and footprint oils.", badge: "Restoration" },
        { title: "Hardwood Glow-Up", desc: "Professional refinishing and waxing for a historic library's oak floors, bringing back the grain.", badge: "Verified" },
        { title: "High-Traffic Carpet Save", desc: "Using truck-mounted extraction to remove heavy mud stains from a busy hotel lobby.", badge: "Deep Clean" }
      ],
      services: [
        { icon: "🧶", title: "Deep Extraction", desc: "Removing deep-seated dirt and allergens from carpet fibers for a fresh feel." },
        { icon: "🧴", title: "Stain Removal", desc: "Specialized treatments for coffee, wine, and pet stains that others leave behind." },
        { icon: "🌬️", title: "Odor Neutralizer", desc: "Eliminating smells at the source rather than just masking them with perfume." },
        { icon: "🪵", title: "Hardwood Polish", desc: "Bringing back the natural glow of your wood floors with premium wax." }
      ]
    }
  ];

  const defaultCategory = {
    expertise: {
      title: "Local Excellence",
      p1: "Your space deserves more than just a surface clean. We bring a detailed-oriented approach to every square inch.",
      p2: "Our teams are local, trained, and committed to making your environment as comfortable and clean as possible."
    },
    stories: [
      { title: "Total Home Refresh", desc: "A complete spring cleaning for a local residence, including windows and hard-to-reach areas.", badge: "Home Care" },
      { title: "Move-In Magic", desc: "Ensuring a new family started their life in a spotless, sanitized environment on short notice.", badge: "Express" },
      { title: "Detailed Restoration", desc: "Focusing on the fine details of a historic property to preserve its character while cleaning.", badge: "Premium" }
    ],
    services: [
      { icon: "🏠", title: "Residential Care", desc: "Complete home cleaning tailored to your lifestyle and specific needs." },
      { icon: "🧹", title: "Deep Dusting", desc: "Removing allergens and dust from every corner, including hard-to-reach areas." },
      { icon: "🧪", title: "Eco-Friendly", desc: "Using safe, non-toxic products that are powerful on dirt but kind to pets." },
      { icon: "🧼", title: "Sanitization", desc: "Eliminating 99.9% of bacteria and viruses from high-touch surfaces." }
    ]
  };

  const matchedCat = categories.find(c => c.keywords.some(k => lowerTitle.includes(k)));
  const currentCtx = matchedCat || defaultCategory;

  // Use hash to pick 3 stories from the selected category pool
  const storiesPool = currentCtx.stories;
  const finalStories = [
    storiesPool[hash % storiesPool.length],
    storiesPool[(hash + 1) % storiesPool.length],
    storiesPool[(hash + 2) % storiesPool.length]
  ];

  // Use hash to pick 3 services from the selected category pool
  const servicesPool = currentCtx.services;
  const finalServices = [
    servicesPool[hash % servicesPool.length],
    servicesPool[(hash + 1) % servicesPool.length],
    servicesPool[(hash + 2) % servicesPool.length]
  ];


  // Dynamic Brand Icon based on keywords
  const emojiMap: Record<string, string> = {
    "kitchen": "🍳",
    "bathroom": "🛁",
    "room": "🛋️",
    "window": "🪟",
    "carpet": "🧶",
    "office": "🏢",
    "industrial": "🏭",
    "vacuum": "🧹",
    "dust": "✨",
    "recurring": "📅",
    "deep": "🧼",
    "apartment": "🏢",
    "residential": "🏠",
    "restoration": "🛠️",
  };

  let brandEmoji = theme.icon;
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lowerTitle.includes(key)) {
      brandEmoji = emoji;
      break;
    }
  }




  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Inter:wght@400;600;700&family=Montserrat:wght@700;900&family=Open+Sans:wght@400;600&family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Sora:wght@700;800&family=Plus+Jakarta+Sans:wght@400;600&display=swap" rel="stylesheet">
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='${theme.primary.replace("#", "%23")}'/%3E%3C/svg%3E" />
    <style>
      :root {
        --primary: ${theme.primary};
        --primary-dark: ${theme.dark};
        --primary-accent: ${theme.accent};
        --bg: ${theme.bg};
        --surface: #ffffff;
        --card-radius: ${borderRadius};
        --btn-radius: ${buttonRadius};
        --font-head: ${font.head};
        --font-body: ${font.body};
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      ::selection { background: var(--primary-light); color: white; }
      body {
        font-family: var(--font-body); color: #0f172a; background: var(--bg);
        line-height: 1.6; -webkit-font-smoothing: antialiased;
      }
      html { scroll-behavior: smooth; scroll-padding-top: 100px; }
      h1, h2, h3, h4 { font-family: var(--font-head); letter-spacing: -0.02em; color: #0f172a; }
      a { color: var(--primary); text-decoration: none; transition: all 0.2s; }
      
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(40px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate { animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .delay-1 { animation-delay: 0.15s; }
      .delay-2 { animation-delay: 0.3s; }
      
      .navbar {
        background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
        position: sticky; top: 0; z-index: 100; border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        padding: 0 5%; height: 80px; display: flex; justify-content: space-between; align-items: center;
        transition: all 0.3s ease;
      }
      .brand { font-size: 1.5rem; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 10px; font-family: 'Outfit', sans-serif; text-decoration: none; }
      .brand .logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg, var(--primary), var(--primary-accent)); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; transform: rotate(-5deg); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
      
      .nav-links { display: flex; gap: 40px; align-items: center; }
      .nav-links a { color: #475569; font-weight: 600; font-size: 0.95rem; text-decoration: none; transition: all 0.2s; position: relative; }
      .nav-links a:after { content: ''; position: absolute; bottom: -6px; left: 0; width: 0; height: 2px; background: #007b5e; transition: width 0.3s; }
      .nav-links a:hover { color: #007b5e; }
      .nav-links a:hover:after { width: 100%; }
      @media (max-width: 950px) { .hide-mobile { display: none !important; } .navbar { height: 70px; } }
      
      .nav-cta {
        padding: 12px 24px; background: #1e293b; color: white; border-radius: 12px;
        font-weight: 700; font-size: 0.95rem; transition: all 0.3s; border: none; cursor: pointer;
        display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(30, 41, 59, 0.15);
      }
      .nav-cta:hover { background: #007b5e; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 123, 94, 0.2); }
      
      .hero {
        position: relative; background: #020617; color: white; padding: 180px 5% 220px;
        display: flex; align-items: center; justify-content: center; overflow: hidden;
      }
      .hero-bg {
        position: absolute; inset: 0;
        background-color: var(--primary-dark);
        background-image: url('${image.replace(/'/g, "\\'")}');
        background-size: cover; background-position: center;
        opacity: 0.4; z-index: 0; filter: contrast(1.1) brightness(0.9);
      }
      .hero-gradient {
        position: absolute; inset: 0; z-index: 1;
        background: linear-gradient(to bottom, rgba(2,6,23,0.2), #020617);
      }
      .hero-content {
        position: relative; z-index: 10; max-width: 950px; text-align: center;
      }
      .hero h1 { font-size: clamp(3rem, 6vw, 5.5rem); font-weight: 900; line-height: 1.05; margin-bottom: 24px; text-shadow: 0 4px 20px rgba(0,0,0,0.6); color: #ffffff; }
      .hero p { font-size: clamp(1.15rem, 2.5vw, 1.5rem); color: #cbd5e1; margin-bottom: 48px; text-shadow: 0 2px 10px rgba(0,0,0,0.4); max-width: 800px; margin-inline: auto; font-weight: 400; line-height: 1.5; }
      
      .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 18px 36px; border-radius: var(--btn-radius); font-weight: 700; font-size: 1.1rem;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; border: none; font-family: var(--font-body);
      }
      .btn-primary { 
        background: var(--primary); color: white;
        box-shadow: 0 10px 20px rgba(0,0,0,0.1);
      }
      .btn-primary:hover { background: var(--primary-dark); transform: translateY(-3px); box-shadow: 0 15px 30px rgba(0,0,0,0.15); }
      .btn-white { background: white; color: var(--text); box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
      .btn-white:hover { transform: translateY(-4px); box-shadow: 0 15px 35px rgba(0,0,0,0.3); color: var(--primary); }
      .cta-group { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }

      .main-grid {
        max-width: 1100px; margin: -120px auto 100px; padding: 0 5%;
        position: relative; z-index: 20; display: block;
      }
      @media (max-width: 1050px) { .main-grid { margin-top: 60px; } .hero { padding: 120px 5% 80px; } }

      .card {
        background: var(--surface); border-radius: var(--card-radius); padding: 48px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); border: 1px solid #f1f5f9;
      }
      
      .section-heading { margin-bottom: 60px; position: relative; }
      .section-heading h2 { font-size: clamp(2rem, 4vw, 3rem); font-weight: 900; margin-bottom: 16px; color: #0f172a; text-align: center; }
      .section-heading h2 span { color: var(--primary); }
      .section-heading .divider { width: 80px; height: 5px; background: var(--primary); margin: 24px auto 0; border-radius: 99px; }
      
      .service-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; }
      .service-card {
        background: var(--surface); border-radius: var(--card-radius); padding: 48px 32px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05); text-align: center;
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s;
        border: 1px solid rgba(0,0,0,0.02);
      }
      .service-card:hover { transform: translateY(-8px); box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1); border-color: var(--primary-accent); }
      .service-card-icon { font-size: 3rem; margin-bottom: 24px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1)); }
      .service-card h3 { font-size: 1.25rem; margin-bottom: 16px; font-weight: 700; color: #1e293b; }
      .service-card p { color: #475569; font-size: 0.95rem; line-height: 1.6; font-weight: 500; }

      .content-area { margin-top: 80px; font-size: 1.15rem; color: #334155; line-height: 1.8; }
      .content-area h2 { font-size: 2.5rem; margin-bottom: 24px; color: var(--text); font-weight: 800; }
      .content-area p { margin-bottom: 24px; }
      .content-area ul { margin-left: 24px; margin-bottom: 24px; }
      .content-area li { margin-bottom: 12px; padding-left: 8px; }
      
      .service-chips { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
      .chip { background: #eef2ff; color: var(--primary-dark); padding: 10px 20px; border-radius: 99px; font-size: 0.95rem; font-weight: 600; }

      .form-card {
        background: #ffffff; padding: 50px; border-radius: var(--card-radius);
        box-shadow: 0 20px 60px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.04);
        max-width: 700px; margin: 0 auto;
      }
      .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
      @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } }
      .input-group label { display: block; font-size: 0.95rem; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
      .input-group input, .input-group select {
        width: 100%; padding: 16px 20px; border-radius: 12px; border: 1px solid #cbd5e1;
        background: #ffffff; font-size: 1rem; color: #1e293b; transition: border-color 0.2s; font-family: inherit;
        outline: none; box-sizing: border-box;
      }
      .input-group input:focus, .input-group select:focus { border-color: var(--primary); }
      .btn-submit {
        width: 100%; background: linear-gradient(135deg, var(--primary), var(--primary-dark));
        color: white; font-weight: 700; font-size: 1.15rem; padding: 18px; border-radius: var(--btn-radius);
        border: none; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); font-family: inherit;
      }
      .btn-submit:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2); }
      
      .nav-links a:hover, .nav-links a:after { background: var(--primary); }
      .nav-links a:hover { color: var(--primary); }

      .project-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 32px; margin-top: 50px; }
      .project-card {
        background: #ffffff; border-radius: var(--card-radius); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
        overflow: hidden; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        border: 1px solid #f1f5f9; display: flex; flex-direction: column; position: relative;
      }
      .project-card:hover { transform: translateY(-12px); box-shadow: 0 30px 60px rgba(0, 0, 0, 0.12); border-color: var(--primary); }
      .project-card-image-wrap { width: 100%; height: 240px; overflow: hidden; position: relative; }
      .project-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s ease; }
      .project-card:hover img { transform: scale(1.1); }
      
      .project-badge {
        position: absolute; top: 20px; left: 20px; background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(8px); padding: 6px 14px; border-radius: 99px;
        font-size: 0.75rem; font-weight: 700; color: var(--primary); text-transform: uppercase;
        letter-spacing: 0.05em; z-index: 5; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .project-card-content { padding: 32px; text-align: left; flex-grow: 1; display: flex; flex-direction: column; }
      .project-card-content h3 { font-size: 1.2rem; font-weight: 800; color: #1e293b; margin-bottom: 12px; line-height: 1.3; }
      .project-card-content p { color: #64748b; font-size: 0.95rem; line-height: 1.6; margin-bottom: 20px; flex-grow: 1; }
      .project-card-link { font-size: 0.9rem; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 6px; }
      .project-card-link:after { content: '→'; transition: transform 0.2s; }
      .project-card:hover .project-card-link:after { transform: translateX(4px); }

      .expertise-section {
        background: var(--primary-dark); color: #f8fafc; padding: 100px 5%; margin-top: 100px;
      }
      .expertise-container {
        max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 60px;
        align-items: center;
      }
      @media (max-width: 900px) { .expertise-container { grid-template-columns: 1fr; } }
      .expertise-content h2 { color: var(--primary-accent); font-size: 2.2rem; margin-bottom: 24px; font-weight: 800; letter-spacing: -0.02em; }
      .expertise-content p { color: #cbd5e1; font-size: 1.05rem; line-height: 1.7; margin-bottom: 20px; }
      .expertise-list { list-style: none; margin-top: 30px; }
      .expertise-list li { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 1.05rem; font-weight: 500; color: #f8fafc; }
      .expertise-list li span { color: #10b981; font-size: 1.25rem; }
      .expertise-image { border-radius: var(--card-radius); overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
      .expertise-image img { width: 100%; height: 100%; object-fit: cover; display: block; }

      .nav-cta:hover { background: var(--primary); }

      .footer { background: #020617; color: #94a3b8; padding: 80px 5%; text-align: center; font-size: 1rem; border-top: 1px solid rgba(255,255,255,0.05); }
      .footer .brand { justify-content: center; color: white; margin-bottom: 20px; font-size: 1.5rem; }
    </style>
  </head>
  <body>
    <nav class="navbar">
      <a href="#home" class="brand">
        <div class="logo-icon">${brandEmoji}</div>
        ${escapeHtml(serviceName)}
      </a>
      
      <div class="nav-links hide-mobile">
        <a href="#home">Home</a>
        <a href="#services">Services</a>
        <a href="#projects">Success Stories</a>
        <a href="#contact">Contact</a>
      </div>

      ${phone ? `<a href="tel:${escapeHtml(phone)}" class="nav-cta">Call Now</a>` : ''}
    </nav>

    <header class="hero" id="home">
      ${image ? `<div class="hero-bg"></div>` : ""}
      <div class="hero-gradient"></div>
      <div class="hero-content animate">
        <h1>${title}</h1>
        ${description ? `<p>${description}</p>` : ""}
        <div class="cta-group">
          <button onclick="document.getElementById('quote').scrollIntoView({behavior: 'smooth'})" class="btn btn-primary">Get a Free Quote</button>
          ${phone ? `<a href="tel:${escapeHtml(phone)}" class="btn btn-white">Call ${escapeHtml(phone)}</a>` : ""}
        </div>
      </div>
    </header>

    <main class="main-grid">
      <div class="main-content">
        <section id="services" class="animate delay-1" style="padding-top: 40px;">
          <div class="section-heading">
            <h2>Specialized <span>${serviceName || 'Entryway'} Solutions</span></h2>
            <div class="divider"></div>
          </div>

          <div class="service-cards">
            ${finalServices.map(s => `
              <div class="service-card">
                <div class="service-card-icon">${s.icon}</div>
                <h3>${escapeHtml(s.title)}</h3>
                <p>${escapeHtml(s.desc)}</p>
              </div>
            `).join('')}
          </div>

          ${contentHtml ? `<div class="content-area" style="margin-top: 40px;">${contentHtml}</div>` : ""}
          
          <div class="service-chips" style="margin-top: 40px; justify-content: center;">
            ${locationFromTitle ? `<span class="chip">📍 Serving ${escapeHtml(locationFromTitle)}</span>` : ""}
            <span class="chip">✓ Licensed & Insured</span>
            <span class="chip">✓ Free Estimates</span>
            <span class="chip">✓ 100% Satisfaction</span>
          </div>
        </section>

        <section id="projects" class="animate delay-2" style="margin-top: 100px;">
          <div class="section-heading">
            <h2>Recent <span>Success Stories</span></h2>
            <p style="color: #475569; text-align: center; margin-top: 12px;">Real results from ${locationFromTitle ? escapeHtml(locationFromTitle) + "'s" : "your area's"} recent challenges.</p>
            <div class="divider"></div>
          </div>
          
          <div class="project-grid">
            ${finalStories.map((s, i) => `
              <div class="project-card">
                <div class="project-badge">${escapeHtml(s.badge)}</div>
                <div class="project-card-image-wrap">
                  <img src="${[p1, p2, p3][i]}" alt="Success Story ${i + 1}" onerror="this.onerror=null; this.src='https://placehold.co/800x600/png?text=Case+Study'">
                </div>
                <div class="project-card-content">
                  <h3>${escapeHtml(s.title)}</h3>
                  <p>${escapeHtml(s.desc)}</p>
                  <div class="project-card-link">View Details</div>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    </main>

    <main class="main-grid" style="margin-top: 0;">
      <aside id="contact" style="padding-top: 80px; padding-bottom: 60px;">
        <div class="section-heading" id="quote">
          <h2>Need Help <span>Right Now?</span></h2>
          <p style="color: #475569; text-align: center; margin-top: 12px; font-size: 1.1rem;">Our crews are stationed near ${locationFromTitle ? escapeHtml(locationFromTitle) : 'you'} for rapid dispatch.</p>
        </div>
        
        <div class="form-card animate delay-1">
          <form onsubmit="return window.__submitQuote?.(event)">
            <div class="form-row">
              <div class="input-group">
                <label for="q_name">Name</label>
                <input id="q_name" placeholder="Your Name" required />
              </div>
              <div class="input-group">
                <label for="q_phone">Phone</label>
                <input id="q_phone" placeholder="Your Phone" value="${escapeHtml(phone)}" required />
              </div>
            </div>
            
            <div class="input-group" style="margin-bottom: 32px;">
              <label for="q_service">Reason for call</label>
              <select id="q_service" style="appearance: auto;">
                <option value="${escapeHtml(serviceName)}">${escapeHtml(serviceName)}</option>
                <option value="Snow Melt Flooding">Snow Melt Flooding</option>
                <option value="Entryway Drying">Entryway Drying</option>
                <option value="Structural Mitigation">Structural Mitigation</option>
              </select>
            </div>
            
            <button type="submit" class="btn-submit">Request Dispatch</button>
            <div id="q_status" style="margin-top: 16px; text-align: center; color: #007b5e; font-weight: 600;"></div>
            
            ${phone ? `<div style="text-align: center; margin-top: 24px; font-size: 1rem; color: #475569; font-weight: 500;">
              Or call immediately: <a href="tel:${escapeHtml(phone)}" style="color: #007b5e; font-weight: 800; text-decoration: underline;">${escapeHtml(phone)}</a>
            </div>` : ''}
          </form>
        </div>
      </aside>
    </main>

    <footer class="footer">
      <div class="brand"><span class="dot"></span> ${title}</div>
      <p>Professional local services. Generated seamlessly from a spreadsheet to Cloudflare Pages.</p>
    </footer>

    <script>
      window.__submitQuote = async function (e) {
        e.preventDefault();
        try {
          var name = document.getElementById('q_name')?.value || '';
          var phone = document.getElementById('q_phone')?.value || '';
          var city = document.getElementById('q_city')?.value || '';
          var service = document.getElementById('q_service')?.value || '';
          var msg = document.getElementById('q_msg')?.value || '';
          var status = document.getElementById('q_status');
          if(status) status.textContent = 'Sending your request...';

          var payload = {
            pageUrl: location.href, service: service, city: city, name: name, phone: phone, message: msg, company: ''
          };

          var endpoint = '${leadEndpoint}'.replace(/\\/$/, '');
          if(endpoint){
            var resp = await fetch(endpoint + '/v1/leads', {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if(resp.ok){
              if(status) status.textContent = 'Awesome! We received your request. We will contact you shortly.';
              return false;
            }
          }

          var wa = '${whatsappUrl}'.split('?')[0];
          if(wa){
            var text = 'Hi, I need a quote for ' + service + (city ? (' in ' + city) : '') + '.\\n' + (name ? ('Name: ' + name + '\\n') : '') + (phone ? ('Phone: ' + phone + '\\n') : '') + (msg ? ('Details: ' + msg + '\\n') : '');
            window.open(wa + '?text=' + encodeURIComponent(text), '_blank');
            if(status) status.textContent = 'Opened WhatsApp to send your request.';
            return false;
          }
          if('${escapeHtml(phone)}'){
             window.location.href = 'tel:${escapeHtml(phone)}';
             if(status) status.textContent = 'Calling...';
             return false;
          }
          if(status) status.textContent = 'Failed to submit. Please add a Phone column in your sheet.';
          return false;
        } catch (err) {
          if(status) status.textContent = 'Could not send. Please try again.';
          return false;
        }
      };
    </script>
  </body>
</html>`;
}
