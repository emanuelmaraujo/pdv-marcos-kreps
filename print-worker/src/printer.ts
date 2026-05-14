const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const CharacterSet = require("node-thermal-printer").characterSet;

export async function initPrinter(): Promise<void> {
  console.log('[PRINTER] Driver ESC/POS inicializado para impressora de rede.');
}

function resolvePrinterColumns(paperWidth: number) {
  if (paperWidth >= 70) return 48;
  if (paperWidth > 0 && paperWidth < 70) return 32;
  return 48;
}

export async function printWithConfig(content: any, printerConfig: {
  printerHost: string;
  printerPort: number;
  printerType: string;
  printerPaperWidth: number;
  printerCharacterSet?: string;
}): Promise<void> {
  
  // Cria uma nova instancia para garantir que a config mais recente seja usada.
  const printer = new ThermalPrinter({
    type: printerConfig.printerType === 'network' ? PrinterTypes.EPSON : PrinterTypes.STAR,
    interface: `tcp://${printerConfig.printerHost}:${printerConfig.printerPort}`,
    characterSet: CharacterSet[printerConfig.printerCharacterSet || 'PC860_PORTUGUESE'] || CharacterSet.PC860_PORTUGUESE,
    width: resolvePrinterColumns(printerConfig.printerPaperWidth),
    removeSpecialCharacters: false,
    lineCharacter: "-",
    breakLine: "WORD"
  });

  // Tenta conectar antes de enviar
  const isConnected = await printer.isPrinterConnected();
  if (!isConnected) {
    throw new Error(`Impressora offline ou inalcancavel em ${printerConfig.printerHost}:${printerConfig.printerPort}`);
  }

  printer.clear();

  // Tratamento do conteudo.
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
    console.error('[PRINTER] Falha critica na execucao da impressao:', error);
    throw error;
  }
}
