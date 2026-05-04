const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
import { config } from "./config";

let printer: any = null;

export async function initPrinter() {
  if (config.printerType === 'network') {
    printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${config.printerHost}:${config.printerPort}`,
      characterSet: "PC852_LATIN2",
      removeSpecialCharacters: false,
      lineCharacter: "-",
      breakLine: "WORD"
    });
    
    try {
      const isConnected = await printer.isPrinterConnected();
      if (isConnected) {
        console.log(`[PRINTER] Conectado à impressora de rede em ${config.printerHost}:${config.printerPort}`);
      } else {
        console.warn(`[PRINTER] Aviso: Não foi possível conectar à impressora em ${config.printerHost}:${config.printerPort}. Continuará tentando durante os jobs.`);
      }
    } catch (e) {
      console.warn(`[PRINTER] Erro ao checar conexão da impressora:`, e);
    }
  } else {
    console.log(`[PRINTER] Tipo de impressora ${config.printerType} não suportado no momento.`);
  }
}

export async function printJobContent(content: any): Promise<void> {
  if (!printer) {
    throw new Error('Impressora não configurada ou inicializada');
  }

  printer.clear();

  // Tratamento genérico do conteúdo sem recriar o cupom complexo.
  // Apenas lemos o payload pré-formatado pelo backend.
  if (typeof content === 'string') {
    printer.println(content);
  } else if (Array.isArray(content)) {
    content.forEach((line: any) => printer.println(String(line)));
  } else if (content && typeof content === 'object') {
    if (content.text) {
      printer.println(content.text);
    } else if (content.lines && Array.isArray(content.lines)) {
      content.lines.forEach((line: any) => printer.println(String(line)));
    } else {
      // Se for um JSON bruto e não tratado, apenas formata em string
      printer.println(JSON.stringify(content, null, 2));
    }
  } else {
    printer.println(String(content));
  }

  printer.cut();

  try {
    await printer.execute();
    console.log('[PRINTER] Impressão executada com sucesso.');
  } catch (error) {
    console.error('[PRINTER] Falha na impressão:', error);
    throw error;
  }
}
