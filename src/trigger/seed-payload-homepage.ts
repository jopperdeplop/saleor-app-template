import { task } from "@trigger.dev/sdk";

// Seed the homepage with the exact content from the current hardcoded page
export const seedPayloadHomepage = task({
  id: "seed-payload-homepage",
  run: async () => {
    const apiUrl = process.env.PAYLOAD_API_URL;
    const apiToken = process.env.PAYLOAD_API_TOKEN;

    if (!apiUrl || !apiToken) {
      throw new Error("Missing PAYLOAD_API_URL or PAYLOAD_API_TOKEN");
    }

    const homepageData = {
      title: "Homepage",
      layout: [
        // Hero Block
        {
          blockType: "hero",
          heading: "The European Standard.",
          subtitle: "A gated community of verified European makers. No middlemen. No compromise on quality. Just improved margins for creators.",
          badge: "Verified European Origin",
          ctaPrimary: {
            label: "Explore the Collection",
            url: "/products",
          },
          ctaSecondary: {
            label: "Our Philosophy",
            url: "#story",
          },
        },
        // Narrative Block
        {
          blockType: "narrative",
          oldWayLabel: "The OLD Way",
          oldWayHeading: "Lost in Middlemen. Drowned in Knockoffs.",
          oldWayText: "Traditional retail is broken. Between the factory and your front door, a chain of middlemen extract value, forcing European brands to compete with unregulated, unsafe mass-production.",
          oldWayText2: "When you buy elsewhere, the creator sees pennies. When you buy here, you empower the studio.",
          quote: "\"Quality is not an act, it is a habit. But in a race to the bottom, habits are the first to break.\"",
          newStandardLabel: "The New Standard",
          newStandardHeading: "Direct Empowerment",
          features: [
            {
              icon: "🛡️",
              title: "Gated & Verified",
              text: "We are a fortress for quality. Only brands adhering to strict EU labor and safety laws are allowed inside. No knockoffs, ever.",
            },
            {
              icon: "🤝",
              title: "Direct Revenue Share",
              text: "By removing the wholesale layer, our partner brands retain up to 3x more revenue. You pay for quality, not logistics.",
            },
            {
              icon: "🌱",
              title: "Ethical & Safe",
              text: "European regulations are the strictest in the world for a reason. Non-toxic materials, fair wages, and lasting durability.",
            },
          ],
        },
        // Brand Ticker Block
        {
          blockType: "brand-ticker",
          sectionLabel: "Verified European Partners",
        },
        // Featured Products Block
        {
          blockType: "product-grid",
          sectionLabel: "The Audit",
          heading: "Featured",
          saleorCollectionId: "", // User needs to set this
          maxProducts: 4,
          layout: "masonry",
        },
        // Collection Cards Block
        {
          blockType: "collection-cards",
          sectionLabel: "Lifestyle",
          heading: "Curated Collections",
          scrollHint: "Scroll to explore →",
          cards: [
            {
              title: "The Minimalist Office",
              subtitle: "Focus without distraction.",
              imageUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1200",
              linkUrl: "/products",
              ctaLabel: "Explore",
            },
            {
              title: "Sustainable Living",
              subtitle: "Ethical choices for every day.",
              imageUrl: "https://images.unsplash.com/photo-1545241047-6083a3684587?q=80&w=1200",
              linkUrl: "/products",
              ctaLabel: "Explore",
            },
            {
              title: "The Weekend Bag",
              subtitle: "Escape in style.",
              imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=1200",
              linkUrl: "/products",
              ctaLabel: "Explore",
            },
          ],
        },
        // Curated Arrivals Block
        {
          blockType: "product-grid",
          heading: "Curated Arrivals",
          saleorCollectionId: "", // User needs to set this
          maxProducts: 8,
          layout: "grid",
          viewAllLabel: "View All",
          viewAllUrl: "/products",
        },
      ],
      seo: {
        metaTitle: "The European Standard | Premium European Brands",
        metaDescription: "A gated community of verified European makers. No middlemen. No compromise on quality.",
      },
    };

    // Create homepage document
    const response = await fetch(`${apiUrl}/api/homepage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(homepageData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to seed homepage:", errorText);
      throw new Error(`Failed to seed homepage: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Homepage seeded successfully:", result.id);

    return { success: true, homepageId: result.id };
  },
});
