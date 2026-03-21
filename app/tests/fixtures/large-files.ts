function generateParagraph(index: number): string {
  return `This is paragraph ${index} with realistic markdown content, inline code like \`const value = ${index};\`, and enough prose to exercise wrapping and scrolling behavior in the renderer.`;
}

function generateCodeBlock(index: number): string {
  return [
    '```ts',
    `export function example${index}(): string {`,
    `  return 'snippet-${index}';`,
    '}',
    '```',
  ].join('\n');
}

function generateTable(index: number): string {
  return [
    '| Column | Value | Notes |',
    '| --- | --- | --- |',
    `| row-${index} | ${index} | generated table content |`,
    `| row-${index + 1} | ${index + 1} | keeps table parsing realistic |`,
  ].join('\n');
}

function generateMermaid(index: number): string {
  return [
    '```mermaid',
    'flowchart TD',
    `  A${index}[Start ${index}] --> B${index}{Decision}`,
    `  B${index} -->|yes| C${index}[Ship]`,
    `  B${index} -->|no| D${index}[Revise]`,
    '```',
  ].join('\n');
}

export function generateLargeMarkdown(lines: number): string {
  const segments: string[] = [];
  let producedLines = 0;
  let mermaidBlocks = 0;

  while (producedLines < lines) {
    const cycle = Math.floor(producedLines / 50) % 5;
    const blockIndex = segments.length + 1;

    const segment =
      cycle === 0
        ? `## Section ${blockIndex}`
        : cycle === 1
          ? generateParagraph(blockIndex)
          : cycle === 2
            ? generateCodeBlock(blockIndex)
            : cycle === 3
              ? generateTable(blockIndex)
              : generateMermaid(blockIndex);

    if (cycle === 4) {
      mermaidBlocks += 1;
    }

    const segmentLines = segment.split('\n');
    segments.push(segment);
    producedLines += segmentLines.length + 1;
  }

  while (mermaidBlocks < 5) {
    segments.push(generateMermaid(10_000 + mermaidBlocks));
    mermaidBlocks += 1;
  }

  return `${segments.join('\n\n')}\n`;
}

export const LARGE_FILE_10K = generateLargeMarkdown(10_000);
export const LARGE_FILE_WITH_MERMAID = generateLargeMarkdown(10_000);
