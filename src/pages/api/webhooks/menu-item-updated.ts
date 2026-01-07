import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "@/saleor-app";
import { translateMenuItem } from "@/trigger/translate-menu-item";

export const menuItemUpdatedWebhook = new SaleorAsyncWebhook<{ menuItem: { id: string } }>({
  name: "Menu Item Updated",
  webhookPath: "api/webhooks/menu-item-updated",
  event: "MENU_ITEM_UPDATED",
  apl: saleorApp.apl,
  query: `subscription { event { ... on MenuItemUpdated { menuItem { id } } } }`,
});

export default menuItemUpdatedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  if (payload.menuItem?.id) {
    console.log(`[Webhook] Menu Item Updated: ${payload.menuItem.id}`);
    await translateMenuItem.trigger({ menuItemId: payload.menuItem.id });
  }
  res.status(200).end();
});
