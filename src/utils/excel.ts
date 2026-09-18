import * as XLSX from 'xlsx';
import { OrderData } from '../types';

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
