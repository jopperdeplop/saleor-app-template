import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "@/saleor-app";
import { translateMenuItem } from "@/trigger/translate-menu-item";

export const menuItemCreatedWebhook = new SaleorAsyncWebhook<{ menuItem: { id: string } }>({
  name: "Menu Item Created",
  webhookPath: "api/webhooks/menu-item-created",
  event: "MENU_ITEM_CREATED",
  apl: saleorApp.apl,
  query: `subscription { event { ... on MenuItemCreated { menuItem { id } } } }`,
});

export default menuItemCreatedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  if (payload.menuItem?.id) {
    console.log(`[Webhook] Menu Item Created: ${payload.menuItem.id}`);
    await translateMenuItem.trigger({ menuItemId: payload.menuItem.id });
  }
  res.status(200).end();
});
