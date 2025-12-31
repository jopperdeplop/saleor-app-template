import { createManifestHandler } from "@saleor/app-sdk/handlers/next";
import { AppExtension, AppManifest } from "@saleor/app-sdk/types";

import packageJson from "@/package.json";

import { orderCreatedWebhook } from "./webhooks/order-created";
import { orderFilterShippingMethodsWebhook } from "./webhooks/order-filter-shipping-methods";
import { shippingMethodsWebhook } from "./webhooks/shipping-methods";
import { productVariantUpdatedWebhook } from "./webhooks/product-variant-updated";
import { productVariantDeletedWebhook } from "./webhooks/product-variant-deleted";
import { productUpdatedWebhook } from "./webhooks/product-updated";
import { categoryCreatedWebhook } from "./webhooks/category-created";
import { categoryUpdatedWebhook } from "./webhooks/category-updated";
import { categoryDeletedWebhook } from "./webhooks/category-deleted";
import { collectionCreatedWebhook } from "./webhooks/collection-created";
import { collectionUpdatedWebhook } from "./webhooks/collection-updated";
import { collectionDeletedWebhook } from "./webhooks/collection-deleted";
import { pageCreatedWebhook } from "./webhooks/page-created";
import { pageUpdatedWebhook } from "./webhooks/page-updated";
import { pageDeletedWebhook } from "./webhooks/page-deleted";

/**
 * App SDK helps with the valid Saleor App Manifest creation. Read more:
 * https://github.com/saleor/saleor-app-sdk/blob/main/docs/api-handlers.md#manifest-handler-factory
 */
export default createManifestHandler({
  async manifestFactory({ appBaseUrl, request, schemaVersion }) {
    /**
     * Allow to overwrite default app base url, to enable Docker support.
     *
     * See docs: https://docs.saleor.io/docs/3.x/developer/extending/apps/local-app-development
     */
    const iframeBaseUrl = process.env.APP_IFRAME_BASE_URL ?? appBaseUrl;
    const apiBaseURL = process.env.APP_API_BASE_URL ?? appBaseUrl;

    const extensionsForSaleor3_22: AppExtension[] = [
      {
        url: apiBaseURL + "/api/server-widget",
        permissions: [],
        mount: "PRODUCT_DETAILS_WIDGETS",
        label: "Product Timestamps",
        target: "WIDGET",
        options: {
          widgetTarget: {
            method: "POST",
          },
        },
      },
      {
        url: iframeBaseUrl + "/client-widget",
        permissions: [],
        mount: "ORDER_DETAILS_WIDGETS",
        label: "Order widget example",
        target: "WIDGET",
        options: {
          widgetTarget: {
            method: "GET",
          },
        },
      },
    ]

    const saleorMajor = schemaVersion && schemaVersion[0];
    const saleorMinor = schemaVersion && schemaVersion[1]

    const is3_22 = saleorMajor === 3 && saleorMinor === 22;

    const extensions = is3_22 ? extensionsForSaleor3_22 : [];

    const manifest: AppManifest = {
      name: "Saleor App Template",
      tokenTargetUrl: `${apiBaseURL}/api/register`,
      appUrl: iframeBaseUrl,
      /**
       * Set permissions for app if needed
       * https://docs.saleor.io/docs/3.x/developer/permissions
       */
      permissions: [
        /**
         * Permissions required for webhooks
         */
        "MANAGE_ORDERS",
        "MANAGE_SHIPPING",
        "MANAGE_PRODUCTS",
        "MANAGE_PAGES",
      ],
      id: "saleor.app",
      version: packageJson.version,
      /**
       * Configure webhooks here. They will be created in Saleor during installation
       * Read more
       * https://docs.saleor.io/docs/3.x/developer/api-reference/webhooks/objects/webhook
       *
       * Easiest way to create webhook is to use app-sdk
       * https://github.com/saleor/saleor-app-sdk/blob/main/docs/saleor-webhook.md
       */
      webhooks: [
        orderCreatedWebhook.getWebhookManifest(apiBaseURL),
        orderFilterShippingMethodsWebhook.getWebhookManifest(apiBaseURL),
        shippingMethodsWebhook.getWebhookManifest(apiBaseURL),
        productVariantUpdatedWebhook.getWebhookManifest(apiBaseURL),
        productVariantDeletedWebhook.getWebhookManifest(apiBaseURL),
        productUpdatedWebhook.getWebhookManifest(apiBaseURL),
        categoryCreatedWebhook.getWebhookManifest(apiBaseURL),
        categoryUpdatedWebhook.getWebhookManifest(apiBaseURL),
        categoryDeletedWebhook.getWebhookManifest(apiBaseURL),
        collectionCreatedWebhook.getWebhookManifest(apiBaseURL),
        collectionUpdatedWebhook.getWebhookManifest(apiBaseURL),
        collectionDeletedWebhook.getWebhookManifest(apiBaseURL),
        pageCreatedWebhook.getWebhookManifest(apiBaseURL),
        pageUpdatedWebhook.getWebhookManifest(apiBaseURL),
        pageDeletedWebhook.getWebhookManifest(apiBaseURL),
      ],
      /**
       * Optionally, extend Dashboard with custom UIs
       * https://docs.saleor.io/docs/3.x/developer/extending/apps/extending-dashboard-with-apps
       */
      extensions: extensions,
      author: "Saleor Commerce",
      brand: {
        logo: {
          default: `${apiBaseURL}/logo.png`,
        },
      },
    };

    return manifest;
  },
});
