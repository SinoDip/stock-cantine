/** Kant van de zaak met een eigen stock. */
export type Area = "keuken" | "front";

export type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  min: number | null;
  location: string | null;
  prep: boolean;
  shelfDays: number | null;
  supplierId: string | null;
  /** Aankoopprijs per eenheid, in euro. */
  price: number | null;
  allergens: string[];
  /** In welke kant(en) dit product gebruikt wordt; minstens één. */
  areas: Area[];
};

/** Eén levering (of één prep-batch) van een product. */
export type Batch = {
  id: string;
  productId: string;
  qty: number;
  remaining: number;
  area: Area;
  received: string; // YYYY-MM-DD
  expires: string | null; // YYYY-MM-DD
  note: string | null;
  createdBy: string | null;
  createdAt: string; // ISO
};

export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  customerNumber: string | null;
  /** 1 = maandag … 7 = zondag */
  orderDays: number[];
  /** "HH:MM" of null */
  orderDeadline: string | null;
  deliveryDays: number[];
  notes: string | null;
};

export type OrderLine = { productId: string; qty: number };

/** Een bestelling die nog onderweg is. */
export type Order = {
  id: string;
  supplierId: string | null;
  createdBy: string | null;
  createdAt: string; // ISO
  lines: OrderLine[];
};

/** Eén product uit een bestelling dat binnenkomt. */
export type ReceiveLine = { productId: string; qty: number; area: Area; expires: string | null };

export type LogEntry = {
  id: number;
  createdAt: string;
  who: string | null;
  action: LogAction;
  productId: string | null;
  productName: string | null;
  qty: number | null;
  detail: string | null;
};

export type LogAction =
  | "use"
  | "adjust"
  | "expiry"
  | "add"
  | "restore"
  | "discard"
  | "remove"
  | "product_add"
  | "product_edit"
  | "product_delete"
  | "supplier_add"
  | "supplier_edit"
  | "supplier_delete"
  | "settings"
  | "order"
  | "order_receive"
  | "order_cancel"
  | "count";

export type Settings = { warnDays: number };

export type StockData = {
  products: Product[];
  batches: Batch[];
  suppliers: Supplier[];
  /** Bestellingen die nog onderweg zijn. */
  orders: Order[];
  settings: Settings;
};

export type ProductInput = Omit<Product, "id">;
export type SupplierInput = Omit<Supplier, "id">;

export type BatchInput = {
  productId: string;
  area: Area;
  qty: number;
  received: string;
  expires: string | null;
  note: string | null;
  createdBy: string | null;
};
