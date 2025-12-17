import { createClient, cacheExchange, fetchExchange } from "urql";
import fetch from "node-fetch";

const SALEOR_API_URL = process.env.SALEOR_API_URL || "https://example.com/graphql";
const rawToken = process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "";
// Handle potential double-bearing or missing token
// This ensures that whether the user pastes "Bearer eyJ..." or just "eyJ...", we end up with just "eyJ..."
const SALEOR_TOKEN = rawToken.replace(/^Bearer\s+/i, "");

if ((!SALEOR_API_URL || SALEOR_API_URL === "https://example.com/graphql") && process.env.NODE_ENV !== 'production') {
  // Only warn if we are clearly not in a build phase where this is expected
  // console.warn("⚠️ Saleor API URL or Token might be missing."); 
}

export const saleorClient = createClient({
  url: SALEOR_API_URL,
  fetch: fetch as any,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => ({
    headers: {
      Authorization: `Bearer ${SALEOR_TOKEN}`,
    },
  }),
});

export function makeSaleorClient(url: string, token: string) {
  return createClient({
    url: url,
    fetch: fetch as any,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
  });
}

// --- COMMON QUERIES ---

export const ORDER_QUERY = `
query GetOrderDetails($id: ID!) {
  order(id: $id) {
    id
    number
    userEmail
    shippingAddress {
      firstName lastName companyName streetAddress1 streetAddress2
      city postalCode country { code } countryArea phone
    }
    lines {
      id
      productName
      quantity
      variant {
        id
        sku
        weight { value unit }
        product {
          name
          attributes {
            attribute { slug }
            values { name }
          }
        }
      }
    }
    shippingMethod {
      id
      name
    }
  }
}
`;

export const WAREHOUSE_QUERY = `
query FindWarehouse($search: String!) {
  warehouses(filter: { search: $search }, first: 1) {
    edges {
      node {
        id
        name
        address {
          firstName lastName companyName streetAddress1 streetAddress2
          city postalCode country { code } countryArea phone
        }
      }
    }
  }
}
`;

export const FULFILLMENT_CREATE = `
mutation FulfillmentCreate($input: FulfillmentCreateInput!) {
  orderFulfill(input: $input) {
    fulfillment { id status trackingNumber }
    errors { field message }
  }
}
`;

export const UPDATE_ORDER_METADATA = `
mutation UpdateOrderMeta($id: ID!, $input: [MetadataInput!]!) {
  updateMetadata(id: $id, input: $input) {
    errors { field message }
  }
}
`;

export const SEARCH_QUERY = `
query GetOrdersByNumber($number: String!) {
  orders(filter: { search: $number }, first: 1) {
    edges { node { id number } }
  }
}
`;

export const PRODUCT_CREATE = `
mutation ProductCreate($input: ProductCreateInput!) {
  productCreate(input: $input) {
    product { id name }
    errors { field message }
  }
}
`;

export const PRODUCT_VARIANT_CREATE = `
mutation ProductVariantCreate($input: ProductVariantCreateInput!) {
  productVariantCreate(input: $input) {
    productVariant { id sku }
    errors { field message }
  }
}
`;

export const PRODUCT_TYPE_QUERY = `
query GetDefaultProductType {
    productTypes(first: 1) {
        edges { node { id name hasVariants } }
    }
}
`;
