import { OrderData } from '../types';

export const SHEETS_CONFIG = {
  appScriptUrl: "https://script.google.com/macros/s/AKfycbzcneSAyEBoDyv8Tk0dZIxYj3KIzH2lG2VTpypUz-LzsDNT8vPmtWHO5chdToubl11C/exec"
};

export async function appendOrderToGoogleSheet(orderData: OrderData): Promise<boolean> {
  if (!SHEETS_CONFIG.appScriptUrl || SHEETS_CONFIG.appScriptUrl.includes('TU_WEB_APP_ID')) {
    console.warn('Falta URL del Apps Script de Google Sheets.');
    return false;
  }

  try {
    const response = await fetch(SHEETS_CONFIG.appScriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'appendOrder',
        order: orderData
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Error al guardar en Google Sheets');
    }

    const result = await response.json();
    if (!result.ok) {
      throw new Error(result.error || 'Google Sheets rechazó el pedido');
    }

    return true;
  } catch (error) {
    console.error('No se pudo guardar el pedido en Google Sheets:', error);
    return false;
  }
}
