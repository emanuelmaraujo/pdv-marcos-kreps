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

// Aplica formatacao ESC/POS linha a linha conforme o conteudo do ticket.
function printFormattedText(printer: any, text: string): void {
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      printer.newLine();
      continue;
    }

    // === separador
    if (/^={5,}$/.test(trimmed)) {
      printer.setTextNormal();
      printer.bold(false);
      printer.alignLeft();
      printer.println(trimmed);
      continue;
    }

    // --- separador
    if (/^-{5,}$/.test(trimmed)) {
      printer.setTextNormal();
      printer.bold(false);
      printer.println(trimmed);
      continue;
    }

    // Marca — "MARCOS KREP'S": grande, negrito, centralizado
    if (/MARCOS KREP/i.test(trimmed)) {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(trimmed);
      printer.setTextNormal();
      printer.bold(false);
      printer.alignLeft();
      continue;
    }

    // Numero do pedido — "PEDIDO P-042" | "COMANDA P-042": grande, negrito, centralizado
    if (/^(PEDIDO|COMANDA)\s+\S/.test(trimmed)) {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(trimmed);
      printer.setTextNormal();
      printer.bold(false);
      printer.alignLeft();
      continue;
    }

    // Lote adicional — "ADICIONAL #2": destaque duplo-altura, centralizado
    if (/^ADICIONAL\s+#/.test(trimmed)) {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(0, 1);
      printer.println(trimmed);
      printer.setTextNormal();
      printer.bold(false);
      printer.alignLeft();
      continue;
    }

    // Secao — "KREPS" | "COZINHA" | "CLIENTE / SENHA": negrito, duplo-altura, centralizado
    if (/^(KREPS|COZINHA|CLIENTE\s*\/\s*SENHA)$/.test(trimmed)) {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(0, 1);
      printer.println(trimmed);
      printer.setTextNormal();
      printer.bold(false);
      printer.alignLeft();
      continue;
    }

    // Nome do cliente — "Cliente: ...": negrito, duplo-altura
    if (/^Cliente:/.test(trimmed)) {
      printer.bold(true);
      printer.setTextSize(0, 1);
      printer.println(trimmed);
      printer.setTextNormal();
      printer.bold(false);
      continue;
    }

    // Linha de item — "P-042-1) 2x Crepe de Nutella": negrito, duplo-altura
    if (/^\S+\)\s+\d+x\s+\S/.test(trimmed)) {
      printer.bold(true);
      printer.setTextSize(0, 1);
      printer.println(trimmed);
      printer.setTextNormal();
      printer.bold(false);
      continue;
    }

    // Para viagem: negrito, centralizado
    if (/PARA VIAGEM/.test(trimmed)) {
      printer.alignCenter();
      printer.bold(true);
      printer.println(trimmed);
      printer.bold(false);
      printer.alignLeft();
      continue;
    }

    // !! NAO COLOCAR — invertido + duplo-altura: maximo destaque
    if (/NAO COLOCAR:/i.test(trimmed)) {
      printer.invert(true);
      printer.bold(true);
      printer.setTextSize(0, 1);
      printer.println(' ' + trimmed + ' ');
      printer.invert(false);
      printer.setTextNormal();
      printer.bold(false);
      continue;
    }

    // Adicionais — duplo-altura, negrito
    if (/ADICIONAIS:/i.test(trimmed)) {
      printer.bold(true);
      printer.setTextSize(0, 1);
      printer.println(trimmed);
      printer.setTextNormal();
      printer.bold(false);
      continue;
    }

    // Observacao — negrito
    if (/^OBS:/i.test(trimmed)) {
      printer.bold(true);
      printer.println(trimmed);
      printer.bold(false);
      continue;
    }

    // Marcador final ">>> PEDIDO P-042 <<<": grande, negrito, centralizado
    if (/^>>>.+<<</.test(trimmed)) {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(trimmed);
      printer.setTextNormal();
      printer.bold(false);
      printer.alignLeft();
      continue;
    }

    // Total de itens — negrito
    if (/^TOTAL ITENS:/.test(trimmed)) {
      printer.bold(true);
      printer.println(trimmed);
      printer.bold(false);
      continue;
    }

    // Padrao
    printer.alignLeft();
    printer.bold(false);
    printer.println(line);
  }
}

export async function printWithConfig(content: any, printerConfig: {
  printerHost: string;
  printerPort: number;
  printerType: string;
  printerPaperWidth: number;
  printerCharacterSet?: string;
}): Promise<void> {

  const printer = new ThermalPrinter({
    type: printerConfig.printerType === 'network' ? PrinterTypes.EPSON : PrinterTypes.STAR,
    interface: `tcp://${printerConfig.printerHost}:${printerConfig.printerPort}`,
    characterSet: CharacterSet[printerConfig.printerCharacterSet || 'PC860_PORTUGUESE'] || CharacterSet.PC860_PORTUGUESE,
    width: resolvePrinterColumns(printerConfig.printerPaperWidth),
    removeSpecialCharacters: false,
    lineCharacter: "-",
    breakLine: "WORD"
  });

  const isConnected = await printer.isPrinterConnected();
  if (!isConnected) {
    throw new Error(`Impressora offline ou inalcancavel em ${printerConfig.printerHost}:${printerConfig.printerPort}`);
  }

  printer.clear();

  let textToPrint: string;
  if (typeof content === 'string') {
    textToPrint = content;
  } else if (content && typeof content === 'object') {
    if (content.text) {
      textToPrint = String(content.text);
    } else if (content.lines && Array.isArray(content.lines)) {
      textToPrint = content.lines.map((l: any) => String(l)).join('\n');
    } else {
      textToPrint = JSON.stringify(content, null, 2);
    }
  } else {
    textToPrint = String(content);
  }

  printFormattedText(printer, textToPrint);

  printer.cut();

  try {
    await printer.execute();
    console.log(`[PRINTER] Job impresso com sucesso em ${printerConfig.printerHost}`);
  } catch (error) {
    console.error('[PRINTER] Falha critica na execucao da impressao:', error);
    throw error;
  }
}
