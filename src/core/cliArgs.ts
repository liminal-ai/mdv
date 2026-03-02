export type ExportFormat = 'pdf' | 'html' | 'docx' | 'all';

export interface UserCliExportArgs {
  input: string;
  output: string;
  format: ExportFormat;
}

export interface InternalCliExportArgs extends UserCliExportArgs {
  cliExport: true;
}

interface ParseSuccess<T> {
  ok: true;
  value: T;
}

interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function usageText(): string {
  return [
    'Usage:',
    '  mdv export --input <path.md> --format pdf|html|docx|all --output <path>',
    '',
    'Examples:',
    '  mdv export --input ./README.md --format pdf --output ./README.pdf',
    '  mdv export --input ./README.md --format docx --output ./README.docx',
    '  mdv export --input ./README.md --format html --output ./out/README-export',
    '  mdv export --input ./README.md --format all --output ./out'
  ].join('\n');
}

export function parseUserCliArgs(argv: string[]): ParseResult<UserCliExportArgs> {
  if (argv[0] !== 'export') {
    return {
      ok: false,
      error: usageText()
    };
  }

  return parseCommonArgs(argv.slice(1));
}

export function parseInternalCliArgs(argv: string[]): ParseResult<InternalCliExportArgs | null> {
  if (!argv.includes('--cli-export')) {
    return { ok: true, value: null };
  }

  const filtered = argv.filter((arg) => arg !== '--cli-export');
  const parsed = parseCommonArgs(filtered);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    value: {
      ...parsed.value,
      cliExport: true
    }
  };
}

function parseCommonArgs(argv: string[]): ParseResult<UserCliExportArgs> {
  const argMap = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current) {
      continue;
    }
    if (!current.startsWith('--')) {
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      return {
        ok: false,
        error: `Missing value for ${current}\n\n${usageText()}`
      };
    }

    argMap.set(current, next);
    i += 1;
  }

  const input = argMap.get('--input');
  const output = argMap.get('--output');
  const formatRaw = argMap.get('--format');

  if (!input || !output || !formatRaw) {
    return {
      ok: false,
      error: `Missing required arguments.\n\n${usageText()}`
    };
  }

  if (!['pdf', 'html', 'docx', 'all'].includes(formatRaw)) {
    return {
      ok: false,
      error: `Invalid --format value: ${formatRaw}\n\n${usageText()}`
    };
  }

  return {
    ok: true,
    value: {
      input,
      output,
      format: formatRaw as ExportFormat
    }
  };
}
