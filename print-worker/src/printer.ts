const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

export async function printWithConfig(content: any, printerConfig: {
  printerHost: string;
  printerPort: number;
  printerType: string;
  printerPaperWidth: number;
}): Promise<void> {
  
  // Criamos uma nova instância para garantir que estamos usando a config mais recente
  const printer = new ThermalPrinter({
    type: printerConfig.printerType === 'network' ? PrinterTypes.EPSON : PrinterTypes.STAR,
    interface: `tcp://${printerConfig.printerHost}:${printerConfig.printerPort}`,
    characterSet: "PC852_LATIN2",
    width: printerConfig.printerPaperWidth,
    removeSpecialCharacters: false,
    lineCharacter: "-",
    breakLine: "WORD"
  });

  // Tenta conectar antes de enviar
  const isConnected = await printer.isPrinterConnected();
  if (!isConnected) {
    throw new Error(`Impressora Offline ou Inalcançável em ${printerConfig.printerHost}:${printerConfig.printerPort}`);
  }

  printer.clear();

  // Tratamento do conteúdo
  if (typeof content === 'string') {
    printer.println(content);
  } else if (content && typeof content === 'object') {
    if (content.text) {
      printer.println(content.text);
    } else if (content.lines && Array.isArray(content.lines)) {
      content.lines.forEach((line: any) => printer.println(String(line)));
    } else {
      printer.println(JSON.stringify(content, null, 2));
    }
  } else {
    printer.println(String(content));
  }

  printer.cut();

  try {
    await printer.execute();
    console.log(`[PRINTER] Job impresso com sucesso em ${printerConfig.printerHost}`);
  } catch (error) {
    console.error('[PRINTER] Falha crítica na execução da impressão:', error);
    throw error;
  }
}
