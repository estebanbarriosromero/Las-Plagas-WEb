import * as XLSX from 'xlsx';
import { OrderData } from '../types';

export const COMPANY_ORDERS_KEY = 'plagasOnlinePedidosEmpresa';
export const COMPANY_DATA_EMAIL = 'esteban.daniel.barrios.romero@students.thepower.education';
export const COMPANY_DATA_PASSWORD = 'Fortnite08';

export interface StoredCompanyOrder {
  'Número de pedido': string;
  'Nombre del cliente': string;
  'Email': string;
  'Dirección': string;
  'Código postal': string;
  'Ciudad': string;
  'Método de pago': string;
  'Productos': string;
  'Total del pedido': string;
  'Fecha': string;
}

export function getCompanyOrders(): StoredCompanyOrder[] {
  try {
    const stored = localStorage.getItem(COMPANY_ORDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('No se pudo leer el historial de pedidos de empresa:', error);
    return [];
  }
}

export function saveCompanyOrders(orders: StoredCompanyOrder[]) {
  try {
    localStorage.setItem(COMPANY_ORDERS_KEY, JSON.stringify(orders));
  } catch (error) {
    console.error('No se pudo guardar el historial de pedidos de empresa:', error);
  }
}

export function recordCompanyOrder(order: OrderData) {
  const currentOrders = getCompanyOrders();
  const newRecord: StoredCompanyOrder = {
    'Número de pedido': order.orderId,
    'Nombre del cliente': order.customerName,
    'Email': order.customerEmail,
    'Dirección': order.shippingAddress,
    'Código postal': order.shippingZip,
    'Ciudad': order.shippingCity,
    'Método de pago': order.paymentMethod,
    'Productos': order.products.map(p => `${p.name} x${p.quantity}`).join(' | '),
    'Total del pedido': order.total,
    'Fecha': order.date || new Date().toLocaleString('es-ES')
  };
  saveCompanyOrders([...currentOrders, newRecord]);
}

export function downloadCompanyOrdersExcel(): boolean {
  const allOrders = getCompanyOrders();
  if (allOrders.length === 0) {
    alert('No hay pedidos guardados para exportar en la base de datos de empresa.');
    return false;
  }

  try {
    const worksheet = XLSX.utils.json_to_sheet(allOrders);
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 24 }, { wch: 30 }, { wch: 34 },
      { wch: 14 }, { wch: 18 }, { wch: 30 }, { wch: 60 },
      { wch: 18 }, { wch: 20 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');
    XLSX.writeFile(workbook, 'Pedidos Empresa.xlsx');
    return true;
  } catch (err) {
    console.error('Error generando Pedidos Empresa.xlsx:', err);
    alert('Error al descargar el archivo Excel.');
    return false;
  }
}

export function exportOrderToExcel(order: OrderData): boolean {
  try {
    const rows = order.products.map(product => ({
      'Número de pedido': order.orderId,
      'Nombre del cliente': order.customerName,
      'Email': order.customerEmail,
      'Dirección': order.shippingAddress,
      'Código postal': order.shippingZip,
      'Ciudad': order.shippingCity,
      'Método de pago': order.paymentMethod,
      'Producto': product.name,
      'Cantidad': product.quantity,
      'Precio unitario': product.unitPrice,
      'Subtotal': product.subtotal,
      'Total del pedido': order.total
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 24 }, { wch: 30 }, { wch: 30 },
      { wch: 14 }, { wch: 18 }, { wch: 34 }, { wch: 48 },
      { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 18 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedido');
    const filename = `pedido-${order.orderId.replace('#', '')}.xlsx`;
    XLSX.writeFile(workbook, filename);
    return true;
  } catch (error) {
    console.error('Error al exportar pedido a Excel:', error);
    return false;
  }
}
