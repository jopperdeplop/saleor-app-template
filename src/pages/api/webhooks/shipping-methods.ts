import { SaleorSyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "@/saleor-app";
import { getShippingRates } from "@/lib/shippo";

// We don't have a generated type for this yet, so we define a minimal interface for the payload
// based on Saleor docs for SHIPPING_LIST_METHODS_FOR_CHECKOUT
interface ShippingMethodsPayload {
  checkout?: {
    id: string;
    shippingAddress: {
      firstName: string;
      lastName: string;
      streetAddress1: string;
      streetAddress2: string;
      city: string;
      countryArea: string; // State
      postalCode: string;
      country: {
        code: string;
      };
      companyName?: string;
      phone?: string;
    };
    lines: Array<{
      quantity: number;
      variant: {
        id: string;
        name: string;
        weight?: {
          value: number;
          unit: string;
        };
      };
    }>;
  };
}

// Minimal query to satisfy the SDK and ensure we get the data we need.
// In a real app, you should use graphql-codegen.
const subscription = `
  subscription {
    event {
      ... on ShippingListMethodsForCheckout {
        checkout {
          id
          shippingAddress {
            firstName
            lastName
            streetAddress1
            streetAddress2
            city
            countryArea
            postalCode
            country {
              code
            }
            companyName
            phone
          }
          lines {
            quantity
            variant {
              id
              name
              weight {
                value
                unit
              }
            }
          }
        }
      }
    }
  }
`;

export const shippingMethodsWebhook = new SaleorSyncWebhook<ShippingMethodsPayload>({
  name: "Shipping List Methods",
  webhookPath: "api/webhooks/shipping-methods",
  event: "SHIPPING_LIST_METHODS_FOR_CHECKOUT",
  apl: saleorApp.apl,
  query: subscription as any, // Cast to any because we skip codegen for now
});

export default shippingMethodsWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  const { checkout } = payload;

  if (!checkout || !checkout.shippingAddress) {
    console.log("⚠️ No checkout or shipping address in payload. Returning empty list.");
    return res.status(200).json([]);
  }

  const addr = checkout.shippingAddress;

  // Map Saleor Address to Shippo Address
  const addressTo = {
    name: `${addr.firstName} ${addr.lastName}`.trim() || addr.companyName || "Valued Customer",
    company: addr.companyName,
    street1: addr.streetAddress1,
    street2: addr.streetAddress2,
    city: addr.city,
    state: addr.countryArea, // Saleor "CountryArea" is usually State/Province
    zip: addr.postalCode,
    country: addr.country.code,
    phone: addr.phone,
    email: "customer@example.com" // Placeholder, email often not in address payload
  };

  // Default From Address (Warehouse) - Reverted to US for Test Mode compatibility
  // Shippo Test Carriers are mostly US-based.
  const addressFrom = {
    name: "Main Warehouse",
    street1: "215 Clayton st",
    city: "San Francisco",
    state: "CA",
    zip: "94117",
    country: "US"
  };

  // Map Lines to Parcels (Simplified: 1 big box or weight based)
  // Shippo needs parcels. Let's just sum weight for now or create a dummy parcel.
  // Real implementation would be smarter.
  const totalWeight = checkout.lines.reduce((acc, line) => {
    return acc + (line.variant.weight?.value || 1) * line.quantity;
  }, 0);
  const weightUnit = checkout.lines[0]?.variant?.weight?.unit || "kg";

  const parcels = [{
    length: "20", width: "20", height: "20", distanceUnit: "cm",
    weight: totalWeight.toString(),
    massUnit: weightUnit.toLowerCase()
  }];

  try {
    const rates = await getShippingRates({
      addressFrom,
      addressTo,
      parcels
    });

    // Map Shippo Rates to Saleor Response
    // WORKAROUND: Force EUR currency because Shippo Test Carriers return USD.
    // Saleor will hide USD rates if store is in EUR.
    const response = rates.map((rate: any) => ({
      id: rate.object_id,
      name: `${rate.provider} ${rate.servicelevel.name}`,
      amount: rate.amount,
      currency: "EUR", // <--- FORCED for testing
      maximum_delivery_days: rate.days || 7
    }));

    console.log(`✅ Returning ${response.length} rates to Saleor.`);
    if (response.length > 0) {
      console.log(`   Sample Rate: ${response[0].name} - ${response[0].amount} ${response[0].currency}`);
    }

    return res.status(200).json(response);
  } catch (e) {
    console.error("Error fetching rates:", e);
    // Return empty list on error so we don't block checkout completely (or maybe we should?)
    // Saleor will just show no synchronous methods.
    return res.status(200).json([]);
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};
