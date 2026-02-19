export type RegisteredService = {
  name: string;
  url: string;
};

export function getRegisteredServices(): RegisteredService[] {
  return [
    {
      name: "catalog",
      url: process.env.SERVICE_CATALOG_URL as string,
    },
    {
      name: "api-gateway",
      url: process.env.SERVICE_API_GATEWAY_URL as string,
    },
    {
      name: "purchase-orders",
      url: process.env.SERVICE_PURCHASE_ORDERS_URL as string,
    },
    {
      name: "users",
      url: process.env.SERVICE_USERS_URL as string,
    }
  ];
}
