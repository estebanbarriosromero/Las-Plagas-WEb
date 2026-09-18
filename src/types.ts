export type ProductCategory = 'all' | 'raticidas' | 'insecticidas' | 'equipos';

export type SortOption = 'default' | 'price-asc' | 'price-desc' | 'rating';

export type ViewType = 
  | 'view-inicio' 
  | 'view-productos' 
  | 'view-contacto' 
  | 'view-login' 
  | 'view-registro' 
  | 'view-carrito' 
  | 'view-checkout' 
  | 'view-success';

export interface Product {
  id: number;
  name: string;
  price: number;
  category: 'raticidas' | 'insecticidas' | 'equipos';
  rating: number;
  distributor: string;
  img: string;
  tagline: string;
  badge: 'bestseller' | 'cheapest' | 'recommended' | null;
  badgeText: string | null;
}

export interface CartItem {
  cartItemId: number;
  id: number;
  name: string;
  price: number;
  distributor: string;
  img: string;
  quantity: number;
}

export interface User {
  name: string;
  email: string;
  password?: string;
}

export interface OrderProductDetail {
  id?: number;
  name: string;
  quantity: number;
  unitPrice?: string;
  subtotal?: string;
  price?: number;
  img?: string;
  distributor?: string;
}

export interface OrderData {
  orderId: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  shippingZip: string;
  shippingCity: string;
  paymentMethod: string;
  total: string;
  products: OrderProductDetail[];
  date?: string;
}

export type PaymentMethodType = 'card' | 'transfer' | 'bizum' | 'btc';
